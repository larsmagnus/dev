export type Status = 'pending' | 'applied' | 'declined' | 'superseded'

/** What the collector reports; `key` is the lesson's stable slug, reused when the lesson recurs. */
export type Finding = {
	key: string
	/** The directory of the session it came from, so an apply can reach project files. */
	project: string
	track: 'context' | 'code'
	type: string
	finding: string
	action: string
	evidence: string[]
}

export type Suggestion = Finding & {
	status: Status
	firstSeen: number
	lastSeen: number
	seenCount: number
	note?: string
}

export type EventName =
	| 'proposed'
	| 'repeated'
	| 'applied'
	| 'declined'
	| 'skipped'
	| 'superseded'

/** One line of the append-only history; never edited, so a suggestion applied and later reopened keeps its whole story. */
export type HistoryEvent = {
	at: number
	key: string
	event: EventName
	note?: string
}

export type QueuedSession = {
	sessionId: string
	cwd: string
	endedAt: number
}

export type LoopState = { lastRun: number | null }

declare module 'claude-code' {
	interface PluginState {
		'feedback-loop': {
			suggestions: Suggestion[]
			selected: string[]
			correction: string
			busy: string | null
			isDismissed: boolean
			isInteractive: boolean
			isScheduled: boolean
			lastRun: number | null
			report: string[]
		}
	}
}
