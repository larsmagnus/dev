import type { On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const ARCHIVE = '/Users/ada/.claude/attachments/session-123'
const paneProps = {
	title: 'Attachments',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

const storedScreenshot = {
	ref: '[Image #2]',
	context: 'Still broken, see [Image #2] where the tab bar overlaps the editor',
	kind: 'image',
	mediaType: 'image/jpeg',
	filename: 'Screenshot 2026-10-11 at 17.16.56.png',
	addedAt: new Date(2026, 9, 11, 17, 18).getTime(),
	path: `${ARCHIVE}/image-2.jpg`,
	thumbPath: `${ARCHIVE}/image-2.thumb.png`,
	width: 1100,
	height: 700,
	bytes: 44_848,
}

/** A resumed session whose archive index holds the given entries; host commands are recorded. */
function resumed(on: On, entries: unknown[]) {
	const ran: (readonly string[])[] = []
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-123' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('fs.read', () => ({ value: JSON.stringify(entries) }))
	on('process.run', (_$, e) => {
		ran.push(e.argv)
		return {
			value: {
				exitCode: 0,
				stdout: '',
				stderr: '',
				isStdoutTruncated: false,
				isStderrTruncated: false,
			},
		}
	})
	return { ran }
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})

const mountPane = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
	$.ui.mount({
		plugin: 'attachments',
		surface,
		component: 'Pane',
		requestId: 'attachments',
		props: paneProps,
	})

for (const surface of ['terminal', 'desktop'] as const)
	test(`should list a resumed session's attachments from its index on the ${surface}`, async ($, on) => {
		resumed(on, [storedScreenshot])
		await startSession($)

		const drawn = JSON.stringify(await (await mountPane($, surface)).drawn())

		expect(drawn).toContain('[Image #2]')
		expect(drawn).toContain('Screenshot 2026-10-11 at 17.16.56.png')
		expect(drawn).toContain('17:18 · 1100×700 · 45 KB')
		expect(drawn).toContain(`${ARCHIVE}/image-2.jpg`)
	})

test('should say nothing is attached in a fresh session', async ($, on) => {
	resumed(on, [])
	await startSession($)

	const drawn = JSON.stringify(await (await mountPane($)).drawn())

	expect(drawn).toContain('Nothing attached yet')
})

test('should insert the ref and its saved path into the prompt when the ref is pressed', async ($, on) => {
	resumed(on, [storedScreenshot])
	const filled: string[] = []
	on('prompt.fill', (_$, e) => {
		filled.push(e.text)
		return { isFilled: true }
	})
	await startSession($)

	await (await mountPane($)).press({ key: `ref:${ARCHIVE}/image-2.jpg` })

	expect(filled).toEqual([`[Image #2] (${ARCHIVE}/image-2.jpg) `])
})

test('should open the file in its default app when its thumbnail is clicked', async ($, on) => {
	const { ran } = resumed(on, [storedScreenshot])
	await startSession($)

	await (
		await mountPane($)
	).pointer({
		type: 'down',
		x: 2,
		y: 1,
		button: 'left',
		in: `thumb:${ARCHIVE}/image-2.jpg`,
	})

	expect(ran).toContainEqual(['open', `${ARCHIVE}/image-2.jpg`])
})

test('should outline a thumbnail in the accent colour while the pointer is over it', async ($, on) => {
	resumed(on, [storedScreenshot])
	await startSession($)

	const drawn = JSON.stringify(await (await mountPane($)).drawn())

	expect(drawn).toContain(
		`"key":"frame:${ARCHIVE}/image-2.jpg","width":14,"height":8,"flexShrink":0`
	)
	expect(drawn).toContain(
		'"hover":{"borderColor":"suggestion","borderDimColor":false}'
	)
})

test('should show the ref once, unbracketed by the button, and the prompt it came with', async ($, on) => {
	resumed(on, [storedScreenshot])
	await startSession($)

	const pane = await mountPane($)
	const ref = await pane.find({ key: `ref:${ARCHIVE}/image-2.jpg` })

	expect(ref?.props).toEqual(
		expect.objectContaining({ label: '[Image #2]', plain: true })
	)
	expect(JSON.stringify(await pane.drawn())).toContain(
		'Still broken, see [Image #2] where the tab bar overlaps the editor'
	)
})
