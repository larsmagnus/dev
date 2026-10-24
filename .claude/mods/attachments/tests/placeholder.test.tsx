import type { On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const COVER_LETTER = '/Users/ada/Documents/Cover letter.txt'
const paneProps = {
	title: 'Attachments',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

const coverLetter = {
	ref: '[File #3]',
	kind: 'file',
	mediaType: 'application/octet-stream',
	filename: 'Cover letter.txt',
	addedAt: new Date(2026, 9, 11, 18, 16).getTime(),
	path: COVER_LETTER,
	bytes: 2333,
}

/** A resumed session holding a file with no thumbnail; every host command exits with the given code and is recorded. */
function resumed(on: On, exitCode: number) {
	const ran: (readonly string[])[] = []
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-123' }))
	on('fs.read', () => ({ value: JSON.stringify([coverLetter]) }))
	on('process.run', (_$, e) => {
		ran.push(e.argv)
		return {
			value: {
				exitCode,
				stdout: '',
				stderr: '',
				isStdoutTruncated: false,
				isStderrTruncated: false,
			},
		}
	})
	return { ran }
}

const mountPane = async ($: Engine) => {
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	return $.ui.mount({
		plugin: 'attachments',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'attachments',
		props: paneProps,
	})
}

test('should name a file with no thumbnail by its extension in a frame that lights on hover', async ($, on) => {
	resumed(on, 0)

	const drawn = JSON.stringify(await (await mountPane($)).drawn())

	expect(drawn).toContain('"label":".txt file"')
	expect(drawn).toContain(`"key":"frame:${COVER_LETTER}"`)
	expect(drawn).toContain(
		'"hover":{"borderColor":"suggestion","borderDimColor":false}'
	)
})

test('should open a file with no thumbnail when its frame is clicked', async ($, on) => {
	const { ran } = resumed(on, 0)

	await (
		await mountPane($)
	).pointer({
		type: 'down',
		x: 4,
		y: 2,
		button: 'left',
		in: `thumb:${COVER_LETTER}`,
	})

	expect(ran).toEqual([['open', COVER_LETTER]])
})

test('should reveal the file in Finder when no app opens it', async ($, on) => {
	const { ran } = resumed(on, 1)

	await (
		await mountPane($)
	).pointer({
		type: 'down',
		x: 4,
		y: 2,
		button: 'left',
		in: `thumb:${COVER_LETTER}`,
	})

	expect(ran).toEqual([
		['open', COVER_LETTER],
		['open', '-R', COVER_LETTER],
	])
})
