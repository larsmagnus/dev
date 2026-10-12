import type { AgentRow } from '../types'

import { addRow, FINISHED, oneLine, SHELL_TITLE } from './activity'

/** The task id a Bash result carries when its command was left running in the background. */
export const backgroundTaskId = (result: unknown) =>
	typeof result === 'object' &&
	result !== null &&
	'backgroundTaskId' in result &&
	typeof result.backgroundTaskId === 'string' &&
	result.backgroundTaskId !== ''
		? result.backgroundTaskId
		: undefined

/** Adds a shell the Bash tool left running in the background: titled `shell`, described by the Bash call's own description when it gave one, its command is drawn as its activity line; `ownerId` is the subagent that ran it, if any. */
export const withShell = (
	rows: AgentRow[],
	taskId: string,
	call: { command: string; description?: string },
	startedAt: number,
	ownerId?: string
) =>
	addRow(rows, {
		id: taskId,
		kind: 'shell',
		ownerId,
		type: SHELL_TITLE,
		description: oneLine(call.description ?? ''),
		command: call.command,
		status: 'running',
		startedAt,
	})

/** The shells still marked running that the engine no longer lists as in flight, so their notification never reached the dock; a shell whose owner is still running is left to end with it. */
export const unlistedShells = (
	rows: AgentRow[],
	inFlight: readonly { id: string }[]
) =>
	rows.filter(
		(row) =>
			row.kind === 'shell' &&
			!FINISHED.has(row.status) &&
			!inFlight.some((task) => task.id === row.id) &&
			!rows.some(
				(owner) => owner.id === row.ownerId && !FINISHED.has(owner.status)
			)
	)
