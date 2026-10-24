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

test('should line up ref, filename, path, prompt and facts in that order beside the thumbnail', async ($, on) => {
	resumed(on, [storedScreenshot])
	await startSession($)

	const drawn = JSON.stringify(await (await mountPane($)).drawn())
	const order = [
		'"label":"[Image #2]"',
		'Screenshot 2026-10-11 at 17.16.56.png',
		`"href":"file://${ARCHIVE}/image-2.jpg"},"children":["${ARCHIVE}/image-2.jpg"]`,
		'Still broken, see [Image #2]',
		'17:18 · 1100×700 · 45 KB',
	].map((text) => drawn.indexOf(text))

	expect(order).not.toContain(-1)
	expect(order).toEqual(order.toSorted((a, b) => a - b))
})

for (const [kind, ref, color] of [
	['image', '[Image #2]', 'ide'],
	['document', '[Attachment #3]', 'merged'],
	['file', '[File #1]', 'warning'],
] as const)
	test(`should colour a ${kind} ref ${color}`, async ($, on) => {
		resumed(on, [{ ...storedScreenshot, kind, ref }])
		await startSession($)

		const drawn = JSON.stringify(await (await mountPane($)).drawn())

		expect(drawn).toContain(
			`{"type":"Text","props":{"color":"${color}"},"children":["${ref}"]}`
		)
	})
