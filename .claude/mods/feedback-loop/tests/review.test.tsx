import type { On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

import type { Suggestion } from '../types'

const bandProps = {
	hasSurvey: false,
	isWorking: false,
	maxRows: 20,
	bodyColumns: 80,
	scroll: { offset: 0, bodyRows: 20 },
	view: {},
} satisfies RenderPropsOf['AbovePrompt']
const paneProps = {
	title: 'Feedback loop',
	isFocused: false,
	bodyColumns: 80,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

const pendingSuggestion = (key: string): Suggestion => ({
	key,
	project: '/work/punchdown',
	track: 'context',
	type: '~/.claude/CLAUDE.md',
	finding: `Finding for ${key}`,
	action: `Persist ${key}`,
	evidence: ['session-123 quote'],
	status: 'pending',
	firstSeen: 1,
	lastSeen: 1,
	seenCount: 2,
})

/** A session with the given ledger on disk; file writes and host commands are recorded. */
function withLedger(
	on: On,
	ledger: Suggestion[],
	runExitCode = 0,
	plist: string | null = '/current/scripts/run.ts',
	lastRun: number | null = null,
	runStdout = ''
) {
	const toasts: string[] = []
	const installed = plist
	const stamped = lastRun
	const summary = runStdout
	const writes: { path: string; text: string }[] = []
	const ran: (readonly string[])[] = []
	mock.env(on, { HOME: '/Users/ada' })
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
	on('ui.render', ($, e) => {
		const { Text } = $.ui.resolve(e)
		return <Text>engine</Text>
	})
	on('session.cwd', () => ({ value: '/work/punchdown' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('fs.list', () => ({
		value: [
			{
				name: 'session-123.json',
				kind: 'file',
				size: 1,
				mtimeMs: 1,
				isLink: false,
			},
		],
	}))
	on('fs.read', (_$, e) => {
		if (e.path.endsWith('state.json') && stamped !== null)
			return { value: JSON.stringify({ lastRun: stamped }) }
		if (!e.path.endsWith('.plist')) {
			return { value: ledger.map((s) => JSON.stringify(s)).join('\n') }
		}
		if (installed === null) throw new Error(`ENOENT: ${e.path}`)
		return { value: installed }
	})
	on('fs.write', (_$, e) => {
		writes.push({ path: e.path, text: e.text })
		return { value: undefined }
	})
	on('process.run', (_$, e) => {
		ran.push(e.argv)
		return {
			value: {
				exitCode: runExitCode,
				stdout: summary,
				stderr: '',
				isStdoutTruncated: false,
				isStderrTruncated: false,
			},
		}
	})
	on('ui.toast', (_$, e) => {
		toasts.push(e.text)
		return { value: undefined }
	})
	on('ui.open', () => ({ value: { isPlaced: true } }))
	return { writes, ran, clock, toasts }
}

const startSession = async (
	$: Engine,
	clock: MockClock,
	isInteractive = true
) => {
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive,
	})
	await clock.advance(0)
}

const endSession = ($: Engine) =>
	$.session.end({
		reason: 'prompt_input_exit',
		sessionId: 'session-123',
		resume: { id: 'session-123' },
	})

const mountBand = ($: Engine) =>
	$.ui.mount({
		plugin: 'feedback-loop',
		surface: 'terminal',
		component: 'AbovePrompt',
		props: bandProps,
	})

const mountPane = ($: Engine) =>
	$.ui.mount({
		plugin: 'feedback-loop',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'feedback-loop',
		props: paneProps,
	})

test('should queue the ending session and start the worker detached', async ($, on) => {
	const { writes, ran, clock } = withLedger(on, [])
	await startSession($, clock)
	ran.length = 0

	await endSession($)

	expect(writes.map((w) => w.path)).toEqual([
		'/Users/ada/.claude/feedback-loop/queue/session-123.json',
	])
	expect(JSON.parse(writes[0]?.text ?? '')).toMatchObject({
		sessionId: 'session-123',
		cwd: '/work/punchdown',
	})
	expect(ran).toHaveLength(1)
	expect(ran[0]?.slice(0, 3)).toEqual([
		'sh',
		'-c',
		'mkdir -p ~/.claude/feedback-loop && nohup node "$0" "$@" >>~/.claude/feedback-loop/run.log 2>&1 &',
	])
	expect(ran[0]?.at(-1)).toBe('collect')
})

test('should not queue a headless session, so the worker never reviews itself', async ($, on) => {
	const { writes, ran, clock } = withLedger(on, [])
	await startSession($, clock, false)

	await endSession($)

	expect(writes).toEqual([])
	expect(ran).toEqual([])
})

test('should say nothing in the band when no suggestion is pending', async ($, on) => {
	const { clock } = withLedger(on, [])
	await startSession($, clock)

	expect(JSON.stringify(await (await mountBand($)).drawn())).not.toContain(
		'feedback-loop'
	)
})

test('should announce pending suggestions in the band and hide it once dismissed', async ($, on) => {
	const { clock } = withLedger(on, [pendingSuggestion('read-before-edit')])
	await startSession($, clock)

	const band = await mountBand($)
	expect(JSON.stringify(await band.drawn())).toContain(
		'1 suggestion pending review'
	)

	await band.press({ key: 'dismiss' })

	expect(JSON.stringify(await band.drawn())).not.toContain('pending review')
})

test('should apply the ticked suggestions with the typed correction', async ($, on) => {
	const { ran, clock } = withLedger(on, [
		pendingSuggestion('read-before-edit'),
		pendingSuggestion('terse-replies'),
	])
	await startSession($, clock)
	const pane = await mountPane($)
	ran.length = 0

	await pane.press({ key: 'toggle:terse-replies' })
	await pane.input({
		key: 'correction',
		text: 'only in the global file',
		kind: 'change',
	})
	await pane.press({ key: 'apply' })

	expect(ran).toHaveLength(1)
	expect(ran[0]?.slice(-2)).toEqual([
		'resolve',
		JSON.stringify({
			apply: ['terse-replies'],
			decline: [],
			correction: 'only in the global file',
		}),
	])
})

test('should decline the ticked suggestions and leave the rest pending', async ($, on) => {
	const { ran, clock } = withLedger(on, [
		pendingSuggestion('read-before-edit'),
		pendingSuggestion('terse-replies'),
	])
	await startSession($, clock)
	const pane = await mountPane($)
	ran.length = 0

	await pane.press({ key: 'toggle:read-before-edit' })
	await pane.press({ key: 'decline' })

	expect(ran[0]?.at(-1)).toBe(
		JSON.stringify({ apply: [], decline: ['read-before-edit'], correction: '' })
	)
})

test('should ask for a tick instead of silently ignoring Apply', async ($, on) => {
	const { ran, clock, toasts } = withLedger(on, [
		pendingSuggestion('read-before-edit'),
	])
	await startSession($, clock)
	const pane = await mountPane($)
	ran.length = 0

	await pane.press({ key: 'apply' })

	expect(ran).toEqual([])
	expect(toasts).toEqual(['feedback-loop: tick a suggestion first'])
})

test('should keep the ticks and correction when the worker did not apply them', async ($, on) => {
	const { clock, toasts } = withLedger(
		on,
		[pendingSuggestion('read-before-edit')],
		75
	)
	await startSession($, clock)
	const pane = await mountPane($)

	await pane.press({ key: 'toggle:read-before-edit' })
	await pane.input({ key: 'correction', text: 'keep this', kind: 'change' })
	await pane.press({ key: 'apply' })

	expect(toasts).toEqual([
		'feedback-loop: a run is busy or failed; see run.log',
	])
	expect(JSON.stringify(await pane.drawn())).toContain('[x]')
	expect(JSON.stringify(await pane.drawn())).toContain('keep this')
})

test('should offer to enable the weekly run only while it is off', async ($, on) => {
	const { clock, ran } = withLedger(on, [], 0, null)
	await startSession($, clock)
	const pane = await mountPane($)
	expect(JSON.stringify(await pane.drawn())).toContain('Enable weekly run')
	ran.length = 0

	await pane.press({ key: 'schedule' })

	expect(ran[0]?.at(-1)).toBe('install-schedule')
})

test('should not offer the weekly run when it is already scheduled', async ($, on) => {
	const { clock } = withLedger(on, [], 0, '/current/scripts/run.ts')
	await startSession($, clock)

	expect(JSON.stringify(await (await mountPane($)).drawn())).not.toContain(
		'Enable weekly run'
	)
})

test('should repoint a weekly job that targets another copy of the script', async ($, on) => {
	const { clock, ran } = withLedger(on, [], 0, '/old-cache/scripts/run.ts')

	await startSession($, clock)

	expect(ran.some((argv) => argv.at(-1) === 'install-schedule')).toBe(true)
})

test('should turn on the weekly run from the install command', async ($, on) => {
	const { clock, ran } = withLedger(on, [], 0, null)
	await startSession($, clock)
	ran.length = 0

	const result = await $.command.run({
		command: 'feedback-loop:install',
		args: '',
		origin: { kind: 'composer' },
		presentation: { isFullscreen: false, columns: 120 },
	})

	expect(ran[0]?.at(-1)).toBe('install-schedule')
	expect(result).toMatchObject({ text: 'feedback-loop: weekly run on' })
})

test('should not start the worker when a run is not due', async ($, on) => {
	const { clock, ran } = withLedger(on, [], 0, null, Date.now() - 1000)
	await startSession($, clock)
	ran.length = 0

	await endSession($)

	expect(ran).toEqual([])
})

test('should show the worker summary after resolving', async ($, on) => {
	const { clock, toasts } = withLedger(
		on,
		[pendingSuggestion('read-before-edit')],
		0,
		null,
		null,
		'0 applied, 1 not applied, 0 declined\n'
	)
	await startSession($, clock)
	const pane = await mountPane($)

	await pane.press({ key: 'toggle:read-before-edit' })
	await pane.press({ key: 'apply' })

	expect(toasts).toEqual([
		'feedback-loop: 0 applied, 1 not applied, 0 declined',
	])
})

test('should show why a suggestion was left pending', async ($, on) => {
	const { clock } = withLedger(on, [
		{
			...pendingSuggestion('read-before-edit'),
			note: 'target file is read-only',
		},
	])
	await startSession($, clock)

	expect(JSON.stringify(await (await mountPane($)).drawn())).toContain(
		'target file is read-only'
	)
})

test('should hide the band once Review opens the pane', async ($, on) => {
	const { clock } = withLedger(on, [pendingSuggestion('read-before-edit')])
	await startSession($, clock)

	const band = await mountBand($)
	await band.press({ key: 'review' })

	expect(JSON.stringify(await band.drawn())).not.toContain('pending review')
})

test('should keep a report of what each suggestion came to in the pane until the next tick', async ($, on) => {
	const { clock } = withLedger(
		on,
		[pendingSuggestion('read-before-edit'), pendingSuggestion('terse-replies')],
		0,
		null,
		null,
		'1 applied, 1 not applied, 0 declined\n+ read-before-edit: edited ~/.claude/CLAUDE.md\nx terse-replies: target file is read-only\n'
	)
	await startSession($, clock)
	const pane = await mountPane($)

	await pane.press({ key: 'toggle:read-before-edit' })
	await pane.press({ key: 'toggle:terse-replies' })
	await pane.press({ key: 'apply' })
	const drawn = JSON.stringify(await pane.drawn())

	expect(drawn).toContain('1 applied, 1 not applied, 0 declined')
	expect(drawn).toContain('+ read-before-edit: edited ~/.claude/CLAUDE.md')
	expect(drawn).toContain('x terse-replies: target file is read-only')

	await pane.press({ key: 'toggle:terse-replies' })

	expect(JSON.stringify(await pane.drawn())).not.toContain('1 applied')
})

test('should report a failed apply in the pane as well as the toast', async ($, on) => {
	const { clock } = withLedger(on, [pendingSuggestion('read-before-edit')], 75)
	await startSession($, clock)
	const pane = await mountPane($)

	await pane.press({ key: 'toggle:read-before-edit' })
	await pane.press({ key: 'apply' })

	expect(JSON.stringify(await pane.drawn())).toContain(
		'a run is busy or failed; see run.log'
	)
})
