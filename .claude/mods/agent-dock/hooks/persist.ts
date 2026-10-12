import type { AgentRow } from '../types'

import { FINISHED } from './activity'

const MAX_SESSIONS = 10

const REQUIRED_FIELDS = {
	id: 'string',
	type: 'string',
	description: 'string',
	status: 'string',
	color: 'string',
	startedAt: 'number',
} as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null

const isRow = (value: unknown): value is AgentRow =>
	isRecord(value) &&
	Object.entries(REQUIRED_FIELDS).every(
		([field, type]) => typeof value[field] === type
	) &&
	Array.isArray(value.recent)

/** Reads the rows stored for a session, ignoring anything that is not a row. */
export const storedRows = (stored: unknown, sessionId: string) => {
	if (!isRecord(stored)) return []
	const rows = stored[sessionId]

	return Array.isArray(rows) ? rows.filter(isRow) : []
}

/** The store's value with this session's rows written last, so only the newest sessions are kept. */
export const withStoredRows = (
	stored: unknown,
	sessionId: string,
	rows: AgentRow[]
) => {
	const others = isRecord(stored)
		? Object.entries(stored).filter(([id]) => id !== sessionId)
		: []

	return Object.fromEntries(
		[...others, [sessionId, rows] as const].slice(-MAX_SESSIONS)
	)
}

/** Rows brought back into a resumed session: whatever was live belonged to a process that is gone, so it ended. */
export const restoreRows = (rows: AgentRow[], at: number) =>
	rows.map((row) =>
		FINISHED.has(row.status)
			? row
			: { ...row, status: 'killed', endedAt: row.endedAt ?? at }
	)
