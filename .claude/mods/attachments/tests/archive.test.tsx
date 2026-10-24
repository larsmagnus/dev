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

/** A fresh session on macOS: writes stay in memory, host commands succeed with `sips` size output, and runs and pane opens are recorded. */
function fresh(on: On) {
	const files: Record<string, string> = {}
	const ran: (readonly string[])[] = []
	const opened: string[] = []
	mock.clock(on, { now: new Date(2026, 9, 11, 17, 20).getTime() })
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-123' }))
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
		ran.push(e.argv)
		const stdout = 'pixelWidth: 1100\npixelHeight: 700\n'
		return {
			value: {
				exitCode: 0,
				stdout,
				stderr: '',
				isStdoutTruncated: false,
				isStderrTruncated: false,
			},
		}
	})
	on('ui.open', (_$, e) => {
		opened.push(e.id)
		return { value: { isPlaced: true } }
	})
	return { files, ran, opened }
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

test('should save a pasted image and list it with its dimensions and size', async ($, on) => {
	const { files, ran } = fresh(on)
	await startSession($)

	await $.session.append({
		uuid: 'row-1',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: {
			type: 'user',
			role: 'user',
			content: [
				{ type: 'text', text: 'Why is this button misaligned? [Image #1]' },
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

	expect(await drawnPane($)).toContain('17:20 · 1100×700 · 45 KB')
	expect(ran).toContainEqual([
		'base64',
		'-D',
		'-o',
		`${ARCHIVE}/image-1-row-1.png`,
	])
	expect(storedIndex(files)).toEqual([
		expect.objectContaining({
			ref: '[Image #1]',
			path: `${ARCHIVE}/image-1-row-1.png`,
			thumbPath: `${ARCHIVE}/image-1-row-1.thumb.png`,
		}),
	])
})

test('should open the pane once, when the first attachment arrives', async ($, on) => {
	const { opened } = fresh(on)
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
	await $.session.append({
		uuid: 'row-2',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: {
			type: 'user',
			role: 'user',
			content: [
				{ type: 'text', text: '[Image #2]' },
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

	expect(opened).toEqual(['attachments'])
})

test('should name a dropped image after its source file once the engine notes the path', async ($, on) => {
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
	await $.session.append({
		uuid: 'row-2',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: {
			type: 'user',
			role: 'user',
			isMeta: true,
			content: [
				{
					type: 'text',
					text: '[Image: source: /Users/ada/Desktop/Screenshot 2026-10-11 at 17.16.56.png]',
				},
			],
		},
	})

	expect(await drawnPane($)).toContain('Screenshot 2026-10-11 at 17.16.56.png')
	expect(storedIndex(files)).toEqual([
		expect.objectContaining({
			ref: '[Image #1]',
			filename: 'Screenshot 2026-10-11 at 17.16.56.png',
		}),
	])
})

test('should archive a PDF as an attachment with no dimensions', async ($, on) => {
	fresh(on)
	await startSession($)

	await $.session.append({
		uuid: 'row-1',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: {
			type: 'user',
			role: 'user',
			content: [
				{ type: 'text', text: 'Summarise this contract' },
				{
					type: 'document',
					source: {
						type: 'base64',
						media_type: 'application/pdf',
						data: 'JVBERi0xLjcKJeLjz9MK',
					},
				},
			],
		},
	})
	const drawn = await drawnPane($)

	expect(drawn).toContain('[Attachment #1]')
	expect(drawn).toContain(`${ARCHIVE}/attachment-1-row-1.pdf`)
	expect(drawn).not.toContain('×')
})

test("should ignore attachments in a subagent's conversation", async ($, on) => {
	const { ran, opened } = fresh(on)
	await startSession($)

	await $.session.append({
		uuid: 'row-1',
		agentId: 'agent-abc123',
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

	expect(await drawnPane($)).toContain('Nothing attached yet')
	expect(opened).toEqual([])
	expect(ran).toEqual([])
})

test('should keep both images when two prompts carry the same ref', async ($, on) => {
	const { files } = fresh(on)
	await startSession($)

	await $.session.append({
		uuid: 'd0b5d374-8a1f-4c2e-9b7a-1f2e3d4c5b6a',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: {
			type: 'user',
			role: 'user',
			content: [
				{ type: 'text', text: 'Before the resume [Image #1]' },
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
	await $.session.append({
		uuid: '7c9e2f41-3b6d-4e8a-a5c1-9d8e7f6a5b4c',
		door: 'prompt',
		origin: { kind: 'composer' },
		message: {
			type: 'user',
			role: 'user',
			content: [
				{ type: 'text', text: 'After the resume [Image #1]' },
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
	await drawnPane($)

	expect(
		storedIndex(files).map((entry: { path: string }) => entry.path)
	).toEqual([
		`${ARCHIVE}/image-1-d0b5d374.png`,
		`${ARCHIVE}/image-1-7c9e2f41.png`,
	])
})
