import type { On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const ARCHIVE = '/Users/ada/.claude/attachments/session-123'
const paneProps = {
	title: 'Attachments',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

/** A fresh session where every host command fails, as `base64 -D` does off macOS; written files are kept in memory. */
function failing(on: On) {
	const files: Record<string, string> = {}
	mock.clock(on, { now: new Date(2026, 9, 11, 18, 30).getTime() })
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-123' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('fs.read', () => ({ value: '[]' }))
	on('fs.write', (_$, e) => {
		files[e.path] = e.text
		return { value: undefined }
	})
	on('process.run', () => ({
		value: {
			exitCode: 1,
			stdout: '',
			stderr: 'invalid input',
			isStdoutTruncated: false,
			isStderrTruncated: false,
		},
	}))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('ui.log', () => ({ value: undefined }))
	return { files }
}

test('should drop an attachment that cannot be saved rather than list a missing file', async ($, on) => {
	const { files } = failing(on)
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})

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
	const mount = () =>
		$.ui.mount({
			plugin: 'attachments',
			surface: 'terminal',
			component: 'Pane',
			requestId: 'attachments',
			props: paneProps,
		})
	await (await mount()).unmount()
	const drawn = JSON.stringify(await (await mount()).drawn())

	expect(drawn).toContain('Nothing attached yet')
	expect(files[`${ARCHIVE}/index.json`]).toBe('[]')
})
