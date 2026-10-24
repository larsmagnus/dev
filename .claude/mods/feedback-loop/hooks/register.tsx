import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { QueuedSession } from '../types'

import { isDue, pending } from './ledger'
import { paneView } from './pane-view'
import { parseSuggestions, parseState } from './parse'

const PANE = 'feedback-loop'

const suggestions = atom(
	{ plugin: 'feedback-loop', key: 'suggestions' } as const,
	[]
)
const selected = atom({ plugin: 'feedback-loop', key: 'selected' } as const, [])
const correction = atom(
	{ plugin: 'feedback-loop', key: 'correction' } as const,
	''
)
const busy = atom({ plugin: 'feedback-loop', key: 'busy' } as const, null)
const report = atom({ plugin: 'feedback-loop', key: 'report' } as const, [])
const isDismissed = atom(
	{ plugin: 'feedback-loop', key: 'isDismissed' } as const,
	false
)

/** Kept in session state, not a module variable, so a reload mid-session doesn't stop the session being queued. */
const isInteractive = atom(
	{ plugin: 'feedback-loop', key: 'isInteractive' } as const,
	false
)

const isScheduled = atom(
	{ plugin: 'feedback-loop', key: 'isScheduled' } as const,
	false
)

/** Mirrors the worker's store path; the two must stay in step. */
async function storeDir($: EngineInterface) {
	return `${await $.env.get('HOME')}/.claude/feedback-loop`
}

/** Mirrors the worker's LaunchAgent path; the two must stay in step. */
async function plistPath($: EngineInterface) {
	return `${await $.env.get('HOME')}/Library/LaunchAgents/co.larsmagnus.feedback-loop.plist`
}

/** Records whether the weekly job exists. A job pointing at another copy of the script, as after a plugin update, is repointed, so enabling it once is enough. */
async function syncSchedule($: EngineInterface) {
	const text = await $.fs.read(await plistPath($)).catch(() => null)
	await update($, isScheduled, () => text !== null)
	if (text !== null && !text.includes(`${$.plugin.root}/scripts/run.ts`))
		await startWorker($, 'install-schedule')
}

/** Re-reads the ledger; the worker owns writes, so the pane only ever displays what is on disk. */
async function reload($: EngineInterface) {
	const text = await $.fs
		.read(`${await storeDir($)}/suggestions.jsonl`)
		.catch(() => '')
	await update($, suggestions, () => parseSuggestions(text))
}

/** Starts the worker detached, so it outlives a session that is closing; the worker itself decides whether a run is due. */
async function startWorker($: EngineInterface, ...args: string[]) {
	await $.process.run([
		'sh',
		'-c',
		'mkdir -p ~/.claude/feedback-loop && nohup node "$0" "$@" >>~/.claude/feedback-loop/run.log 2>&1 &',
		`${$.plugin.root}/scripts/run.ts`,
		...args,
	])
}

/** Starts the worker only when a run is due, so most sessions cost no Node startup. */
async function startIfDue($: EngineInterface) {
	const dir = await storeDir($)
	const queued = await $.fs.list(`${dir}/queue`).catch(() => [])
	const state = parseState(await $.fs.read(`${dir}/state.json`).catch(() => ''))
	if (isDue(state, queued.length, Date.now())) await startWorker($, 'collect')
}

/** Queues the ending session for the next run, one file per session so concurrent writers never clash. */
async function enqueue($: EngineInterface, sessionId: string) {
	const item: QueuedSession = {
		sessionId,
		cwd: await $.session.cwd(),
		endedAt: Date.now(),
	}
	await $.fs.write(
		`${await storeDir($)}/queue/${sessionId}.json`,
		JSON.stringify(item)
	)
}

/** Applies or declines the ticked suggestions through the worker, then shows the ledger as it ended up. */
async function settle($: EngineInterface, decision: 'apply' | 'decline') {
	const keys = await read($, selected)
	if (keys.length === 0) {
		$.ui.toast('feedback-loop: tick a suggestion first')
		return
	}

	const note = await read($, correction)
	await update($, busy, () => `${decision} ${keys.length}…`)
	try {
		const { exitCode, stdout } = await $.process.run(
			[
				'node',
				`${$.plugin.root}/scripts/run.ts`,
				'resolve',
				JSON.stringify({
					apply: decision === 'apply' ? keys : [],
					decline: decision === 'decline' ? keys : [],
					correction: note,
				}),
			],
			{ timeoutMs: 10 * 60 * 1000 }
		)
		if (exitCode !== 0) throw new Error('a run is busy or failed; see run.log')
		const lines = stdout.trim().split('\n')
		await update($, selected, () => [])
		await update($, correction, () => '')
		await update($, report, () => lines)
		$.ui.toast(`feedback-loop: ${lines[0] || `${decision} done`}`)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		await update($, report, () => [message])
		$.ui.toast(`feedback-loop: ${message}`)
	} finally {
		await update($, busy, () => null)
		await reload($)
	}
}

/** Flips one suggestion's tick. */
const toggle = ($: EngineInterface) => (key: string) => async () => {
	await update($, report, () => [])
	await update($, selected, (keys) =>
		keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
	)
}

/** Mirrors the correction field into state as the user types. */
const typeInto = ($: EngineInterface) => (value: string) =>
	update($, correction, () => value)

/** Binds a decision for a button, which fires with no arguments. */
const settleWith = ($: EngineInterface, decision: 'apply' | 'decline') => () =>
	settle($, decision)

/** Starts a run now, bypassing the due check. */
const forceRun = ($: EngineInterface) => () =>
	startWorker($, 'collect', '--force')

/** Re-reads the ledger on demand, since the worker may have written since the pane opened. */
const refresh = ($: EngineInterface) => () => reload($)

/** Installs and loads the weekly job, then reports in one line whether it took. */
async function scheduleWeekly($: EngineInterface) {
	const { exitCode } = await $.process.run([
		'node',
		`${$.plugin.root}/scripts/run.ts`,
		'install-schedule',
	])
	await syncSchedule($)

	return exitCode === 0
		? 'feedback-loop: weekly run on'
		: 'feedback-loop: could not schedule; see run.log'
}

/** Turns on the weekly job from the pane, so nobody needs a terminal. */
const enableSchedule = ($: EngineInterface) => async () =>
	$.ui.toast(await scheduleWeekly($))

/** Hides the band; the pane stays reachable through the command. */
const dismiss = ($: EngineInterface) => () => update($, isDismissed, () => true)

/** Reloads before opening, so the pane never shows a stale ledger. Hides the band, since the pane now shows what it announced. */
const open = ($: EngineInterface) => async () => {
	await reload($)
	await update($, isDismissed, () => true)
	await $.ui.open({ id: PANE, title: 'Feedback loop', focus: true })
}

/** Wires the plugin's session, command and render hooks into the engine. */
export const register: Register = (on) => {
	on('session.start', async ($, e, next) => {
		await update($, isInteractive, () => e.isInteractive)
		if (!e.isInteractive) return next(e)

		$.clock.after(0, async () => {
			await reload($)
			await syncSchedule($).catch(() => undefined)
			await startIfDue($).catch(() => undefined)
		})

		return next(e)
	})

	on('session.end', async ($, e, next) => {
		if (await read($, isInteractive)) {
			await enqueue($, e.sessionId).catch(() => undefined)
			await startIfDue($).catch(() => undefined)
		}

		return next(e)
	})

	on('command.run', { command: 'feedback-loop:install' }, async ($) => ({
		text: await scheduleWeekly($),
	}))

	on('command.run', { command: 'feedback-loop:open' }, async ($) => {
		await open($)()

		return { text: 'Feedback loop opened.' }
	})

	on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
		const waiting = pending(await read($, suggestions))
		if (
			e.props.hasSurvey ||
			waiting.length === 0 ||
			(await read($, isDismissed))
		)
			return next(e)

		const { Box, Button, Text } = $.ui.resolve(e)

		return (
			<Box
				justifyContent="space-between"
				borderStyle="round"
				borderColor="suggestion"
				paddingX={2}
			>
				<Text>
					<Text color="claude">feedback-loop</Text>{' '}
					{`${waiting.length} suggestion${waiting.length === 1 ? '' : 's'} pending review`}
				</Text>
				<Box gap={2}>
					<Button key="review" label="Review" onPress={open($)} />
					<Button key="dismiss" label="x" onPress={dismiss($)} />
				</Box>
			</Box>
		)
	})

	on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
		const model = {
			waiting: pending(await read($, suggestions)),
			ticked: await read($, selected),
			correction: await read($, correction),
			busy: await read($, busy),
			isScheduled: await read($, isScheduled),
			report: await read($, report),
		}

		return paneView($.ui.resolve(e), model, {
			toggle: toggle($),
			type: typeInto($),
			apply: settleWith($, 'apply'),
			decline: settleWith($, 'decline'),
			run: forceRun($),
			refresh: refresh($),
			enableSchedule: enableSchedule($),
		})
	})
}
