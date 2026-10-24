import {
	appendFile,
	readFile,
	readdir,
	rename,
	writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { parseQueued, parseSuggestions, toLines } from '../hooks/parse.ts'
import type { QueuedSession, Suggestion } from '../types'

export const HOME = homedir()
export const STORE = join(HOME, '.claude', 'feedback-loop')
export const FILES = {
	state: join(STORE, 'state.json'),
	suggestions: join(STORE, 'suggestions.jsonl'),
	history: join(STORE, 'history.jsonl'),
	queue: join(STORE, 'queue'),
	reports: join(STORE, 'reports'),
	lock: join(STORE, 'run.lock'),
	log: join(STORE, 'run.log'),
}

/** Reads a file, or returns an empty string if it cannot be read. */
export const readOrEmpty = (path: string) =>
	readFile(path, 'utf8').catch(() => '')

/** Appends a timestamped failure line to the run log. */
export const log = (message: string) =>
	appendFile(FILES.log, `${new Date().toISOString()} ${message}\n`)

/** Rewrites through a rename so a reader never sees a half-written ledger. */
async function writeAtomic(path: string, text: string) {
	const temp = `${path}.tmp`
	await writeFile(temp, text)
	await rename(temp, path)
}

/** Reads every queued session, skipping files that fail validation. */
export async function readQueue(): Promise<QueuedSession[]> {
	const names = await readdir(FILES.queue).catch(() => [])
	const texts = await Promise.all(
		names.map((name) => readOrEmpty(join(FILES.queue, name)))
	)

	return texts.flatMap(parseQueued)
}

/** The ledger as it is on disk. */
export const readLedger = async (): Promise<Suggestion[]> =>
	parseSuggestions(await readOrEmpty(FILES.suggestions))

/** Replaces the ledger atomically and appends the events that explain the change. */
export async function saveLedger(
	suggestions: Suggestion[],
	events: readonly unknown[]
) {
	await writeAtomic(FILES.suggestions, toLines(suggestions))
	await appendFile(FILES.history, toLines(events))
}
