import { isRecord } from '../hooks/parse.ts'
import type { Suggestion } from '../types'

import { ask } from './ask.ts'
import { isOutcome } from './edits.ts'
import type { Outcome } from './edits.ts'
import { READ_ONLY_TOOLS, RESULTS_SCHEMA } from './schemas.ts'

/** Asks a read-only headless Claude to propose edits for the ticked suggestions. Claude Code refuses headless writes under `.claude/`, so the mod writes them itself. Makes no call when none are ticked. */
export async function proposeEdits(
	keys: string[],
	correction: string,
	ledger: Suggestion[]
): Promise<Outcome[]> {
	if (keys.length === 0) return []

	const chosen = ledger.filter((s) => keys.includes(s.key))
	const prompt = [
		'Suggestions to apply:',
		...chosen.map(
			(s) => `- ${s.key} [${s.type}]: ${s.finding}\n  action: ${s.action}`
		),
		'',
		`User notes: ${correction || '(none)'}`,
	].join('\n')
	const output = await ask({
		promptFile: 'apply.md',
		prompt,
		schema: RESULTS_SCHEMA,
		tools: READ_ONLY_TOOLS,
		permissionMode: 'dontAsk',
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
