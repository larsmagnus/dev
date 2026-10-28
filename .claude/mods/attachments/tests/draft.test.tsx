import type { FsEntry, On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const ARCHIVE = '/Users/ada/.claude/attachments/session-123'
const IMAGES = '/tmp/claude-501/-Users-ada-work/session-123/images'
const DIAGRAM = '/Users/ada/Desktop/Architecture diagram.png'
const POLL_MS = 200
const bandProps = {
	hasSurvey: false,
	isWorking: false,
	maxRows: 20,
	bodyColumns: 80,
	scroll: { offset: 0, bodyRows: 20 },
	view: {},
} satisfies RenderPropsOf['AbovePrompt']
const PROJECTS: FsEntry[] = [
	{ name: '-Users-ada-work', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
]
const PASTES: FsEntry[] = [
	{ name: '1.png', kind: 'file', size: 9000, mtimeMs: 0, isLink: false },
	{ name: '2.webp', kind: 'file', size: 9000, mtimeMs: 0, isLink: false },
]

function typing(on: On) {
	const ran: (readonly string[])[] = []
	const draft = { text: '' }
	const clock = mock.clock(on, { now: new Date(2026, 9, 28, 20, 11).getTime() })
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-123' }))
	on('fs.read', () => ({ value: '[]' }))
	on('fs.write', () => ({ value: undefined }))
	on('fs.list', (_$, e) => ({
		value: e.path === '/tmp/claude-501' ? PROJECTS : PASTES,
	}))
	on('fs.exists', (_$, e) => ({ value: e.path === IMAGES }))
	on('fs.stat', (_$, e) =>
		e.path === DIAGRAM
			? { value: { kind: 'file', size: 52_000, mtimeMs: 0, isLink: false } }
			: Promise.reject(new Error(`ENOENT: ${e.path}`))
	)
	on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
		const { Box } = $.ui.resolve(e)
		return <Box />
	})
	on('prompt.read', () => ({
		value: { text: draft.text, cursor: draft.text.length },
	}))
	on('process.run', (_$, e) => {
		ran.push(e.argv)
		return {
			value: {
				exitCode: 0,
				stdout:
					e.argv[0] === 'id' ? '501\n' : 'pixelWidth: 1100\npixelHeight: 700\n',
				stderr: '',
				isStdoutTruncated: false,
				isStderrTruncated: false,
			},
		}
	})
	return { ran, draft, clock }
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})

const mountBand = ($: Engine) =>
	$.ui.mount({
		plugin: 'attachments',
		surface: 'terminal',
		component: 'AbovePrompt',
		requestId: 'band',
		props: bandProps,
	})

const drawnBand = async ($: Engine) =>
	JSON.stringify(await (await mountBand($)).drawn())

test('should show a thumbnail for each pasted image the draft still names', async ($, on) => {
	const { draft, clock } = typing(on)
	await startSession($)

	draft.text = 'Compare [Image #1] with [Image #2]'
	await clock.advance(POLL_MS)
	const drawn = await drawnBand($)

	expect(drawn).toContain('#1')
	expect(drawn).toContain('#2')
	expect(drawn).toContain(`${ARCHIVE}/draft/0.thumb.png`)
	expect(drawn).toContain(`${ARCHIVE}/draft/1.thumb.png`)
})

test('should show a thumbnail for an existing file whose path the draft names', async ($, on) => {
	const { draft, clock } = typing(on)
	await startSession($)

	draft.text = `Does "${DIAGRAM}" still match?`
	await clock.advance(POLL_MS)

	expect(await drawnBand($)).toContain(DIAGRAM)
})

test('should drop the thumbnails once the draft is sent', async ($, on) => {
	const { draft, clock } = typing(on)
	await startSession($)
	draft.text = 'Compare [Image #1] with [Image #2]'
	await clock.advance(POLL_MS)

	draft.text = ''
	await clock.advance(POLL_MS)

	expect(await drawnBand($)).not.toContain('#1')
})

test('should drop the thumbnail of an image whose ref was deleted from the draft', async ($, on) => {
	const { draft, clock } = typing(on)
	await startSession($)
	draft.text = 'Compare [Image #1] with [Image #2]'
	await clock.advance(POLL_MS)

	draft.text = 'Compare [Image #2]'
	await clock.advance(POLL_MS)
	const drawn = await drawnBand($)

	expect(drawn).not.toContain('#1')
	expect(drawn).toContain('#2')
})

test('should open the file in its default app when its tile is clicked', async ($, on) => {
	const { ran, draft, clock } = typing(on)
	await startSession($)
	draft.text = `Does "${DIAGRAM}" still match?`
	await clock.advance(POLL_MS)

	await (
		await $.ui.mount({
			plugin: 'attachments',
			surface: 'terminal',
			component: 'AbovePrompt',
			requestId: 'band',
			props: bandProps,
		})
	).pointer({
		type: 'down',
		x: 2,
		y: 1,
		button: 'left',
		in: `thumb:${DIAGRAM}`,
	})

	expect(ran).toContainEqual(['open', DIAGRAM])
})
