import { resolve, skip } from '../hooks/ledger.ts'
import { isRecord, isStringArray } from '../hooks/parse.ts'
import type { Suggestion } from '../types'

import { ask } from './ask.ts'
import { EDIT_TOOLS, RESULTS_SCHEMA } from './schemas.ts'
import { readLedger, saveLedger } from './store.ts'

type Outcome = { key: string; outcome: 'applied' | 'skipped'; note: string }

export type Resolution = {
	apply: string[]
	decline: string[]
	correction: string
}

/** Narrows one model result row. */
const isOutcome = (value: unknown): value is Outcome =>
	isRecord(value) &&
	typeof value.key === 'string' &&
	(value.outcome === 'applied' || value.outcome === 'skipped') &&
	typeof value.note === 'string'

/** Validates the `resolve` argument; throws on anything malformed. */
export const parseResolution = (text: string): Resolution => {
	const value: unknown = JSON.parse(text)
	if (
		!isRecord(value) ||
		!isStringArray(value.apply) ||
		!isStringArray(value.decline) ||
		typeof value.correction !== 'string'
	)
		throw new Error('resolve expects {apply, decline, correction}')

	return {
		apply: value.apply,
		decline: value.decline,
		correction: value.correction,
	}
}

/** Asks a headless editor to apply the ticked suggestions. Makes no call when none are ticked. */
async function applyEdits(
	keys: string[],
	correction: string,
	ledger: Suggestion[]
) {
	if (keys.length === 0) return []

	const chosen = ledger.filter((s) => keys.includes(s.key))
	const prompt = [
		'Suggestions to apply:',
		...chosen.map(
			(s) => `- ${s.key} [${s.type}]: ${s.finding}\n  action: ${s.action}`
		),
		'',
		`User corrections: ${correction || '(none)'}`,
	].join('\n')
	const output = await ask({
		promptFile: 'apply.md',
		prompt,
		schema: RESULTS_SCHEMA,
		tools: EDIT_TOOLS,
		permissionMode: 'acceptEdits',
		model: 'sonnet',
		budgetUsd: 2,
		addDirs: [...new Set(chosen.map((s) => s.project))],
		// Under the pane's own ten-minute wait, so the lock is released before the pane gives up.
		timeoutMs: 9 * 60 * 1000,
	})
	if (!isRecord(output) || !Array.isArray(output.results))
		throw new Error('applier returned no results array')

	return output.results.filter(isOutcome)
}

/** One report line per ticked suggestion; a key the applier never mentioned reads as not applied. */
const outcomeLine = (key: string, outcomes: Outcome[]) => {
	const outcome = outcomes.find((o) => o.key === key)
	if (!outcome) return `x ${key}: no result reported`

	return `${outcome.outcome === 'applied' ? '+' : 'x'} ${key}: ${outcome.note}`
}

/** Applies the ticked suggestions, then records applied, skipped and declined ones, and returns a one-line summary for the pane. Skipped suggestions stay pending with the reason. */
export async function resolveSelection(request: Resolution): Promise<string> {
	const now = Date.now()
	const note = request.correction || undefined
	const outcomes = (
		await applyEdits(request.apply, request.correction, await readLedger())
	).filter((o) => request.apply.includes(o.key))
	const applied = outcomes.filter((o) => o.outcome === 'applied')
	const skipped = outcomes.filter((o) => o.outcome === 'skipped')

	let ledger = await readLedger()
	const events = []
	for (const outcome of applied) {
		const step = resolve(ledger, [outcome.key], 'applied', now, outcome.note)
		ledger = step.suggestions
		events.push(...step.events)
	}
	const skippedStep = skip(ledger, skipped, now)
	const declined = resolve(
		skippedStep.suggestions,
		request.decline,
		'declined',
		now,
		note
	)
	await saveLedger(declined.suggestions, [
		...events,
		...skippedStep.events,
		...declined.events,
	])

	return [
		`${applied.length} applied, ${request.apply.length - applied.length} not applied, ${request.decline.length} declined`,
		...request.apply.map((key) => outcomeLine(key, outcomes)),
		...request.decline.map((key) => `- ${key}: declined`),
	].join('\n')
}
