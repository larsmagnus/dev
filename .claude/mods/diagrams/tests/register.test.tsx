import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import { splitFences } from '../hooks/segments'

const FLOW = 'graph TD\n  A[Client] --> B[API gateway]'
const flowFence = (variant: string) =>
	`\`\`\`mermaid\n${FLOW}\n  B --> ${variant}\n\`\`\``
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const noop = {
	exitCode: 0,
	stderr: '',
	isStdoutTruncated: false,
	isStderrTruncated: false,
}

/** A session where Chrome is installed and draws a 332x269 diagram unless `dump` says otherwise; runs and toasts are recorded. */
function drawing(
	on: On,
	{
		dump = '<body data-size="332x269">',
		isChromeInstalled = true,
		isLibraryInstalled = true,
		copyExitCode = 0,
	} = {}
) {
	const ran: (readonly string[])[] = []
	const toasts: string[] = []
	const clock = mock.clock(on, { now: new Date(2026, 9, 28, 21, 30).getTime() })
	mock.env(on, { HOME: '/Users/ada' })
	on('session.id', () => ({ value: 'session-1' }))
	on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
		const { Text } = $.ui.resolve(e)
		return <Text>engine drawing</Text>
	})
	on('fs.stat', (_$, e) =>
		(isChromeInstalled && e.path === CHROME) ||
		e.path.endsWith('.png') ||
		(isLibraryInstalled && e.path.endsWith('.min.js'))
			? { value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } }
			: Promise.reject(new Error(`ENOENT: ${e.path}`))
	)
	on('fs.write', () => ({ value: undefined }))
	on('ui.log', () => ({ value: undefined }))
	on('ui.toast', (_$, e) => {
		toasts.push(e.text)
		return { value: undefined }
	})
	on('process.run', (_$, e) => {
		ran.push(e.argv)
		return {
			value: {
				...noop,
				exitCode: e.argv[0] === 'cp' ? copyExitCode : 0,
				stdout: e.argv.includes('--dump-dom') ? dump : '',
			},
		}
	})
	return { ran, toasts, clock }
}

const mountReply = (
	$: Engine,
	text: string,
	{
		surface = 'terminal',
		isSummary,
	}: { surface?: 'terminal' | 'desktop'; isSummary?: true } = {}
) =>
	$.ui.mount({
		plugin: 'diagrams',
		surface,
		component: 'AssistantMessage',
		props: { text, isFirstOfReply: true, ...(isSummary && { isSummary }) },
	})

const settle = async (clock: MockClock) => {
	await clock.advance(0)
	await clock.advance(0)
}

const drawnJson = async (ui: Awaited<ReturnType<typeof mountReply>>) =>
	JSON.stringify(await ui.drawn())

test('should leave a reply without a diagram to the engine', async ($, on) => {
	const { ran } = drawing(on)

	const ui = await mountReply($, 'The migration finished in 42 seconds.')

	expect(await drawnJson(ui)).toContain('engine drawing')
	expect(ran).toEqual([])
})

test('should leave a summary to the engine', async ($, on) => {
	const { ran, clock } = drawing(on)

	const ui = await mountReply($, `Summary:\n${flowFence('S1')}`, {
		isSummary: true,
	})
	await settle(clock)

	expect(await drawnJson(ui)).toContain('engine drawing')
	expect(ran).toEqual([])
})

test('should leave the source to the engine until the diagram has drawn', async ($, on) => {
	const { ran } = drawing(on)

	const ui = await mountReply($, `Flow:\n${flowFence('C1')}`)

	expect(await drawnJson(ui)).toContain('engine drawing')
	expect(ran).toEqual([])
})

test('should show the picture with a source button once Chrome has drawn it', async ($, on) => {
	const { clock } = drawing(on)
	const text = `Flow:\n${flowFence('C2')}`
	const { hash } = splitFences(text).find((s) => s.kind === 'diagram')!

	const ui = await mountReply($, text)
	await settle(clock)

	const image = await ui.find({ type: 'Image' })
	expect(image).toBeDefined()
	expect(JSON.stringify(await ui.drawn())).toContain(
		`/Users/ada/.claude/diagrams/${hash}-dark.png`
	)
	expect(await ui.find({ type: 'Button', text: '[source]' })).toBeDefined()
})

test('should show the fence and a diagram button after pressing source', async ($, on) => {
	const { clock } = drawing(on)
	const text = `Flow:\n${flowFence('C3')}`

	const ui = await mountReply($, text)
	await settle(clock)
	await ui.press({ key: 'toggle:1' })

	expect(await ui.find({ type: 'Image' })).toBeUndefined()
	expect(await drawnJson(ui)).toContain('API gateway')
	expect(await ui.find({ type: 'Button', text: '[diagram]' })).toBeDefined()
})

test('should keep the source and not retry when the diagram fails to draw', async ($, on) => {
	const { ran, clock } = drawing(on, { dump: '<body data-failed="true">' })
	const text = `Flow:\n${flowFence('C4')}`

	const ui = await mountReply($, text)
	await settle(clock)
	const runsAfterFailure = ran.length
	await mountReply($, text)
	await settle(clock)

	expect(await drawnJson(ui)).toContain('engine drawing')
	expect(await ui.find({ type: 'Image' })).toBeUndefined()
	expect(ran.length).toBe(runsAfterFailure)
})

test('should toast once when no Chrome is found, across two diagrams', async ($, on) => {
	const { toasts, clock } = drawing(on, { isChromeInstalled: false })

	const ui = await mountReply($, `${flowFence('C5')}\n${flowFence('C6')}`)
	await settle(clock)

	expect(toasts).toEqual([
		'diagrams: no Chrome found, set chromePath in /config',
	])
	expect(await drawnJson(ui)).toContain('engine drawing')
})

test('should toast once to run the install skill when the libraries are missing', async ($, on) => {
	const { toasts, ran, clock } = drawing(on, { isLibraryInstalled: false })

	const ui = await mountReply($, `${flowFence('C8')}\n${flowFence('C9')}`)
	await settle(clock)

	expect(toasts).toEqual(['diagrams: libraries missing, run /diagrams:install'])
	expect(ran).toEqual([])
	expect(await drawnJson(ui)).toContain('engine drawing')
})

test('should leave a reply to the engine on the desktop surface', async ($, on) => {
	const { ran, clock } = drawing(on)

	const ui = await mountReply($, `Flow:\n${flowFence('C7')}`, {
		surface: 'desktop',
	})
	await settle(clock)

	expect(await drawnJson(ui)).toContain('engine drawing')
	expect(ran).toEqual([])
})

test('should sweep stale Chrome profiles and old pictures when a session starts', async ($, on) => {
	const { ran, clock } = drawing(on)
	on('session.start', (_$, e) => ({ cwd: e.cwd }))

	await $.session.start({
		cwd: '/Users/ada/projects/api',
		surface: 'terminal',
		isInteractive: true,
	})
	await settle(clock)

	const sweeps = ran.filter((argv) => argv[0] === 'find')
	expect(sweeps.map((argv) => [argv[1], argv[5], argv[7]])).toEqual([
		['/Users/ada/.claude/diagrams', 'profile-*', '+1'],
		['/Users/ada/.claude/diagrams', '*.png', '+30'],
	])
})

const drawnDiagram = async (
	$: Engine,
	clock: MockClock,
	variant: string,
	{ isSourceShown = false } = {}
) => {
	const text = `Flow:\n${flowFence(variant)}`
	const diagram = splitFences(text).find((s) => s.kind === 'diagram')!
	const ui = await mountReply($, text)
	await settle(clock)
	if (isSourceShown) await ui.press({ key: 'toggle:1' })
	return { ui, diagram }
}

test('should show source, copy and download buttons above the picture', async ($, on) => {
	const { clock } = drawing(on)

	const { ui } = await drawnDiagram($, clock, 'D1')

	expect(await ui.find({ type: 'Button', text: '[source]' })).toBeDefined()
	expect(await ui.find({ type: 'Button', text: '[copy]' })).toBeDefined()
	expect(await ui.find({ type: 'Button', text: '[download]' })).toBeDefined()
	expect(await ui.find({ type: 'Image' })).toBeDefined()
})

test('should copy the source without its fence and toast when copying the picture view', async ($, on) => {
	const { clock, toasts } = drawing(on)
	const copied: string[] = []
	on('ui.copy', (_$, e) => {
		copied.push(e.text)
		return { value: { isCopied: true } }
	})

	const { ui } = await drawnDiagram($, clock, 'D2')
	await ui.press({ key: 'copy:1' })

	expect(copied).toEqual([`${FLOW}\n  B --> D2`])
	expect(toasts).toContain('diagrams: source copied')
})

test('should copy the source without its fence while the source is shown', async ($, on) => {
	const { clock, toasts } = drawing(on)
	const copied: string[] = []
	on('ui.copy', (_$, e) => {
		copied.push(e.text)
		return { value: { isCopied: true } }
	})

	const { ui } = await drawnDiagram($, clock, 'D3', { isSourceShown: true })
	await ui.press({ key: 'copy:1' })

	expect(copied).toEqual([`${FLOW}\n  B --> D3`])
	expect(toasts).toContain('diagrams: source copied')
})

test('should toast the reason when copying fails', async ($, on) => {
	const { clock, toasts } = drawing(on)
	on('ui.copy', (_$, _e) => ({
		value: { isCopied: false, reason: 'no-clipboard' },
	}))

	const { ui } = await drawnDiagram($, clock, 'D4')
	await ui.press({ key: 'copy:1' })

	expect(toasts).toContain('diagrams: copy failed, no-clipboard')
})

test('should save the picture to Downloads and toast the path when download is pressed', async ($, on) => {
	const { clock, ran, toasts } = drawing(on)

	const { ui, diagram } = await drawnDiagram($, clock, 'D5')
	await ui.press({ key: 'download:1' })

	const target = `/Users/ada/Downloads/mermaid-${diagram.hash}.png`
	expect(ran).toContainEqual([
		'cp',
		`/Users/ada/.claude/diagrams/${diagram.hash}-dark.png`,
		target,
	])
	expect(toasts).toContain(`diagrams: saved ${target}`)
})

test('should save the picture while the source is shown', async ($, on) => {
	const { clock, ran } = drawing(on)

	const { ui, diagram } = await drawnDiagram($, clock, 'D6', {
		isSourceShown: true,
	})
	await ui.press({ key: 'download:1' })

	expect(
		ran.some((argv) => argv[0] === 'cp' && argv[2]?.includes(diagram.hash))
	).toBe(true)
})

test('should toast a failure when the picture cannot be copied to Downloads', async ($, on) => {
	const { clock, toasts } = drawing(on, { copyExitCode: 1 })

	const { ui } = await drawnDiagram($, clock, 'D7')
	await ui.press({ key: 'download:1' })

	expect(toasts).toContain('diagrams: download failed')
	expect(toasts.some((text) => text.startsWith('diagrams: saved'))).toBe(false)
})

test('should open the picture when the overlay on it is pressed', async ($, on) => {
	const { clock, ran } = drawing(on)

	const { ui, diagram } = await drawnDiagram($, clock, 'D8')
	await ui.post({ open: true }, { in: `open:${diagram.hash}` })

	expect(ran).toContainEqual([
		'open',
		`/Users/ada/.claude/diagrams/${diagram.hash}-dark.png`,
	])
})
