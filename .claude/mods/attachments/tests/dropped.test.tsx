import type { On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const ARCHIVE = '/Users/ada/.claude/attachments/session-123'
const CONTRACT = '/Users/ada/sites/pdfix/samples/sample-a.pdf'
const DIAGRAM = '/Users/ada/Desktop/Architecture diagram.png'
const ON_DISK = new Set([CONTRACT, DIAGRAM])
const paneProps = {
	title: 'Attachments',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

/** A fresh session where only a contract PDF and a diagram PNG exist on disk; host commands are recorded and `sips` measures every picture 1100×700. */
function fresh(on: On) {
	const ran: (readonly string[])[] = []
	mock.clock(on, { now: new Date(2026, 9, 11, 17, 45).getTime() })
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-123' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('fs.read', () => ({ value: '[]' }))
	on('fs.write', () => ({ value: undefined }))
	on('fs.stat', (_$, e) =>
		ON_DISK.has(e.path)
			? { value: { kind: 'file', size: 1_532_000, mtimeMs: 0, isLink: false } }
			: Promise.reject(new Error(`ENOENT: ${e.path}`))
	)
	on('process.run', (_$, e) => {
		ran.push(e.argv)
		return {
			value: {
				exitCode: 0,
				stdout: 'pixelWidth: 1100\npixelHeight: 700\n',
				stderr: '',
				isStdoutTruncated: false,
				isStderrTruncated: false,
			},
		}
	})
	on('ui.open', () => ({ value: { isPlaced: true } }))
	return { ran }
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})

const prompt = ($: Engine, text: string) =>
	$.session.append({
		uuid: 'row-1',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: { type: 'user', role: 'user', content: [{ type: 'text', text }] },
	})

const drawnPane = async ($: Engine) =>
	JSON.stringify(
		await (
			await $.ui.mount({
				plugin: 'attachments',
				surface: 'terminal',
				component: 'Pane',
				requestId: 'attachments',
				props: paneProps,
			})
		).drawn()
	)

test('should list a dropped PDF where it lies, with its name, size and a first-page thumbnail', async ($, on) => {
	const { ran } = fresh(on)
	await startSession($)

	await prompt($, CONTRACT)
	const drawn = await drawnPane($)

	expect(drawn).toContain('[File #1]')
	expect(drawn).toContain('sample-a.pdf')
	expect(drawn).toContain('17:45 · 1.5 MB')
	expect(drawn).toContain(`file://${CONTRACT}`)
	expect(drawn).toContain(`${ARCHIVE}/file-1-row-1.thumb.png`)
	expect(ran.some((argv) => argv[0] === 'base64')).toBe(false)
})

test('should not list a path that names no file', async ($, on) => {
	fresh(on)
	await startSession($)

	await prompt(
		$,
		'Is /Users/ada/sites/pdfix/samples/missing.pdf still referenced anywhere?'
	)

	expect(await drawnPane($)).toContain('Nothing attached yet')
})

test('should measure an image named by path, quoted and followed by punctuation', async ($, on) => {
	fresh(on)
	await startSession($)

	await prompt($, `Does "${DIAGRAM}", the one from the review, still match?`)
	const drawn = await drawnPane($)

	expect(drawn).toContain('[File #1]')
	expect(drawn).toContain('1100×700')
	expect(drawn).toContain(
		'"href":"file:///Users/ada/Desktop/Architecture%20diagram.png"'
	)
})

test('should not list an archived file again when its ref is inserted back into a prompt', async ($, on) => {
	fresh(on)
	await startSession($)

	await prompt($, CONTRACT)
	await prompt($, `Compare [File #1] (${CONTRACT}) with the draft`)
	const drawn = await drawnPane($)

	expect(drawn).toContain('[File #1]')
	expect(drawn).not.toContain('[File #2]')
})
