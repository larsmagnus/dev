import type {
	EventName,
	Finding,
	HistoryEvent,
	LoopState,
	Status,
	Suggestion,
} from '../types'

/** Sessions that make a run due before the week is up. */
const DUE_SESSIONS = 10
const DUE_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const MIN_GAP_MS = 60 * 60 * 1000
const MAX_EVIDENCE = 5

/** Decides whether a run should start now. The minimum gap stops a failing run retrying at every session end. */
export const isDue = (state: LoopState, queued: number, now: number) => {
	const sinceLast = now - (state.lastRun ?? 0)

	return (
		sinceLast >= MIN_GAP_MS &&
		(queued >= DUE_SESSIONS || (queued > 0 && sinceLast >= DUE_AFTER_MS))
	)
}

/** Builds one append-only history line. */
const event = (
	key: string,
	name: EventName,
	at: number,
	note?: string
): HistoryEvent => ({ at, key, event: name, ...(note && { note }) })

/** Keeps the newest distinct evidence, so the pane shows a lesson's latest sightings. */
const mergeEvidence = (known: string[], incoming: string[]) =>
	[...new Set([...known, ...incoming])].slice(-MAX_EVIDENCE)

/** Folds new findings into the ledger by key. A repeat of an applied suggestion reopens it, because the fix evidently did not hold; declined and superseded ones stay closed and only log the sighting. */
export function mergeFindings(
	suggestions: Suggestion[],
	findings: Finding[],
	now: number
): { suggestions: Suggestion[]; events: HistoryEvent[] } {
	const byKey = new Map(suggestions.map((s) => [s.key, s]))
	const events: HistoryEvent[] = []

	for (const finding of findings) {
		const known = byKey.get(finding.key)
		if (!known) {
			byKey.set(finding.key, {
				...finding,
				status: 'pending',
				firstSeen: now,
				lastSeen: now,
				seenCount: 1,
			})
			events.push(event(finding.key, 'proposed', now))
			continue
		}

		const isReopened = known.status === 'applied'
		byKey.set(finding.key, {
			...known,
			status: isReopened ? 'pending' : known.status,
			lastSeen: now,
			seenCount: known.seenCount + 1,
			evidence: mergeEvidence(known.evidence, finding.evidence),
		})
		events.push(
			event(
				finding.key,
				'repeated',
				now,
				isReopened ? 'recurred after applied; reopened' : undefined
			)
		)
	}

	return { suggestions: [...byKey.values()], events }
}

/** Records why an apply left suggestions pending, so the pane can show the reason instead of a silent no-op. */
export function skip(
	suggestions: Suggestion[],
	skipped: readonly { key: string; note: string }[],
	now: number
): { suggestions: Suggestion[]; events: HistoryEvent[] } {
	const notes = new Map(skipped.map((s) => [s.key, s.note]))

	return {
		suggestions: suggestions.map((s) =>
			notes.has(s.key) ? { ...s, note: notes.get(s.key) } : s
		),
		events: skipped.map((s) => event(s.key, 'skipped', now, s.note)),
	}
}

/** Moves the named suggestions to `status`, logging each; unknown keys are ignored. */
export function resolve(
	suggestions: Suggestion[],
	keys: readonly string[],
	status: Extract<Status, 'applied' | 'declined' | 'superseded'>,
	now: number,
	note?: string
): { suggestions: Suggestion[]; events: HistoryEvent[] } {
	const targeted = suggestions.filter((s) => keys.includes(s.key))

	return {
		suggestions: suggestions.map((s) =>
			keys.includes(s.key) ? { ...s, status, ...(note && { note }) } : s
		),
		events: targeted.map((s) => event(s.key, status, now, note)),
	}
}

/** Suggestions still awaiting a decision. */
export const pending = (suggestions: readonly Suggestion[]) =>
	suggestions.filter((s) => s.status === 'pending')

/** One line per suggestion, for the collector to reuse keys instead of minting near-duplicates. */
export const ledgerDigest = (suggestions: readonly Suggestion[]) =>
	suggestions.map((s) => `${s.key} [${s.status}] ${s.finding}`).join('\n')
