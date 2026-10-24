import type { Finding, LoopState, QueuedSession, Suggestion } from '../types'

/** Narrows to a non-null object. Arrays pass too. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

/** Narrows to an array of strings. An empty array passes. */
export const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string')

/** True for a finding with every field the ledger depends on. */
export const isFinding = (value: unknown): value is Finding =>
	isRecord(value) &&
	typeof value.key === 'string' &&
	typeof value.project === 'string' &&
	value.key !== '' &&
	(value.track === 'context' || value.track === 'code') &&
	typeof value.type === 'string' &&
	typeof value.finding === 'string' &&
	typeof value.action === 'string' &&
	isStringArray(value.evidence)

const STATUSES = new Set<unknown>([
	'pending',
	'applied',
	'declined',
	'superseded',
])

/** A ledger line: a finding with its status and sighting count. */
const isSuggestion = (value: unknown): value is Suggestion =>
	isFinding(value) &&
	'status' in value &&
	STATUSES.has(value.status) &&
	'seenCount' in value &&
	typeof value.seenCount === 'number'

/** Validates one queue file. */
const isQueuedSession = (value: unknown): value is QueuedSession =>
	isRecord(value) &&
	typeof value.sessionId === 'string' &&
	typeof value.cwd === 'string' &&
	typeof value.endedAt === 'number'

/** Parses JSON lines, skipping blank and corrupt ones so a torn write costs one record, not the ledger. */
const parseLines = <T>(text: string, guard: (v: unknown) => v is T): T[] =>
	text.split('\n').flatMap((line) => {
		try {
			const value: unknown = JSON.parse(line)
			return guard(value) ? [value] : []
		} catch {
			return []
		}
	})

/** Reads the ledger, one suggestion per valid line. */
export const parseSuggestions = (text: string) => parseLines(text, isSuggestion)

/** Reads the queue, one session per valid line. */
export const parseQueued = (text: string): QueuedSession[] =>
	parseLines(text, isQueuedSession)

/** Reads the last run time; anything unreadable counts as never run. */
export const parseState = (text: string): LoopState => {
	try {
		const value: unknown = JSON.parse(text)
		return isRecord(value) && typeof value.lastRun === 'number'
			? { lastRun: value.lastRun }
			: { lastRun: null }
	} catch {
		return { lastRun: null }
	}
}

/** Serialises records as JSON lines, one trailing newline each. */
export const toLines = (items: readonly unknown[]) =>
	items.map((item) => `${JSON.stringify(item)}\n`).join('')
