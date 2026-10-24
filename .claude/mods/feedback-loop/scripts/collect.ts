import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { isDue, ledgerDigest, mergeFindings } from '../hooks/ledger.ts'
import { isFinding, isRecord, parseState } from '../hooks/parse.ts'
import type { Finding, QueuedSession } from '../types'

import { ask } from './ask.ts'
import { FINDINGS_SCHEMA, READ_ONLY_TOOLS } from './schemas.ts'
import {
	FILES,
	readLedger,
	readOrEmpty,
	readQueue,
	saveLedger,
} from './store.ts'

/** Renders the run's raw report, kept for debugging the collector. */
const reportOf = (findings: Finding[], sessions: QueuedSession[]) =>
	[
		`# Run over ${sessions.length} sessions`,
		'',
		...sessions.map((s) => `- ${s.sessionId} (${s.cwd})`),
		'',
		...findings.map(
			(f) =>
				`## ${f.key}\n\n${f.finding}\n\n[${f.type}] ${f.action}\n\n${f.evidence.map((e) => `- ${e}`).join('\n')}\n`
		),
	].join('\n')

/** Reviews the queue and merges findings into the ledger. The queue is cleared last, so a failed run leaves its sessions for a later one. */
export async function collect(isForced: boolean) {
	const now = Date.now()
	const sessions = await readQueue()
	const state = parseState(await readOrEmpty(FILES.state))
	if (
		sessions.length === 0 ||
		(!isForced && !isDue(state, sessions.length, now))
	)
		return

	const suggestions = await readLedger()
	const prompt = [
		'Queued sessions (id, cwd):',
		...sessions.map((s) => `${s.sessionId}\t${s.cwd}`),
		'',
		'Known suggestions (key [status] finding):',
		ledgerDigest(suggestions) || '(none yet)',
	].join('\n')

	// Stamped before the work, so a failure backs off instead of retrying at every trigger.
	await writeFile(FILES.state, JSON.stringify({ lastRun: now }))
	const output = await ask({
		promptFile: 'collect.md',
		prompt,
		schema: FINDINGS_SCHEMA,
		tools: READ_ONLY_TOOLS,
		permissionMode: 'dontAsk',
		model: 'sonnet',
		budgetUsd: 3,
		addDirs: [...new Set(sessions.map((s) => s.cwd))],
		timeoutMs: 30 * 60 * 1000,
	})
	// A malformed answer must not clear the queue, or the week's sessions are lost unreviewed.
	if (!isRecord(output) || !Array.isArray(output.findings))
		throw new Error('collector returned no findings array')
	const findings = output.findings.filter(isFinding)
	const merged = mergeFindings(suggestions, findings, now)

	await saveLedger(merged.suggestions, merged.events)
	await mkdir(FILES.reports, { recursive: true })
	await writeFile(
		join(FILES.reports, `${new Date(now).toISOString()}.md`),
		reportOf(findings, sessions)
	)
	await Promise.all(
		sessions.map((s) =>
			rm(join(FILES.queue, `${s.sessionId}.json`), { force: true })
		)
	)
}

/** Runs one command under the single run lock. install-schedule runs unlocked, since it only writes a plist. */
