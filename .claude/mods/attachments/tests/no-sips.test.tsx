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

/** A fresh session where `sips` cannot start, as off macOS: files in memory, other host commands succeed. */
function fresh(on: On) {
	const files: Record<string, string> = {}
	mock.clock(on, { now: new Date(2026, 9, 11, 17, 20).getTime() })
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-123' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('fs.read', (_$, e) => {
		throw new Error(`ENOENT: ${e.path}`)
	})
	on('fs.write', (_$, e) => {
		files[e.path] = e.text
		return { value: undefined }
	})
	on('fs.stat', () => ({
		value: { kind: 'file', size: 44_848, mtimeMs: 0, isLink: false },
	}))
	on('process.run', (_$, e) => {
		const result = {
			exitCode: 0,
			stdout: '',
			stderr: '',
			isStdoutTruncated: false,
			isStderrTruncated: false,
		}
		return e.argv[0] === 'sips'
			? Promise.reject(new Error('spawn sips ENOENT'))
			: { value: result }
	})
	on('ui.open', () => ({ value: { isPlaced: true } }))
	return { files }
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
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

const storedIndex = (files: Record<string, string>) =>
	JSON.parse(files[`${ARCHIVE}/index.json`] ?? '[]')

test('should still list a pasted image with a placeholder when sips is unavailable', async ($, on) => {
	const { files } = fresh(on)
	await startSession($)

	await $.session.append({
		uuid: 'row-1',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: {
			type: 'user',
			role: 'user',
			content: [
				{ type: 'text', text: '[Image #1]' },
				{
					type: 'image',
					source: {
						type: 'base64',
						media_type: 'image/png',
						data: 'iVBORw0KGgoAAAANSUhEUg',
					},
				},
			],
		},
	})
	const drawn = await drawnPane($)

	expect(drawn).toContain('"label":".png image"')
	expect(drawn).toContain(`${ARCHIVE}/image-1-row-1.png`)
	expect(storedIndex(files)[0]).not.toHaveProperty('thumbPath')
})
