import type { AgentInfo } from 'claude-code'

import type { AgentRow } from '../types'

import { FINISHED } from './activity'

const DEFAULT_AUTO_ARCHIVE_MINUTES = 20
const FAILED = new Set(['failed', 'killed'])

let autoArchiveMs = DEFAULT_AUTO_ARCHIVE_MINUTES * 60_000

/** Reads the auto-archive option in minutes; 0 or less leaves archiving to the person. */
export const setAutoArchive = (option: unknown) => {
	const minutes =
		typeof option === 'number' && Number.isFinite(option)
			? option
			: DEFAULT_AUTO_ARCHIVE_MINUTES
	autoArchiveMs = minutes * 60_000
}

const isArchivable = (row: AgentRow) =>
	!row.isArchived && FINISHED.has(row.status)

/** Collapses finished agents that ended before `before` into the archive; nothing is ever removed. */
export const archiveFinished = (
	rows: AgentRow[],
	before = Number.POSITIVE_INFINITY
) =>
	rows.map((row) =>
		isArchivable(row) && (row.endedAt ?? 0) < before
			? { ...row, isArchived: true }
			: row
	)

/** Archives agents that have been finished for longer than the auto-archive option allows. */
export const autoArchive = (rows: AgentRow[], at: number) =>
	autoArchiveMs > 0 ? archiveFinished(rows, at - autoArchiveMs) : rows

/** Whether a finished agent still waits to be auto-archived, which keeps the tick running while nothing else is live. */
export const hasPendingArchive = (rows: AgentRow[]) =>
	autoArchiveMs > 0 && rows.some(isArchivable)

/** The agents to list, newest first: the unarchived ones, then the archived ones while the archive is open. */
export const listedRows = (rows: AgentRow[], isArchiveOpen: boolean) => {
	const newest = rows.toReversed()
	const active = newest.filter((row) => !row.isArchived)

	return isArchiveOpen
		? [...active, ...newest.filter((row) => row.isArchived)]
		: active
}

/** Agents the engine reports failed or killed that were still live when last folded. */
export const newFailures = (rows: AgentRow[], listed: AgentInfo[]) =>
	listed.filter(
		(info) =>
			FAILED.has(info.status) &&
			rows.some((row) => row.id === info.id && !FINISHED.has(row.status))
	)
