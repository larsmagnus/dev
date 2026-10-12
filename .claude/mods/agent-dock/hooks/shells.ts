import type { AgentRow } from '../types'

import { addRow, clipTitle, oneLine } from './activity'

/** The task id a Bash result carries when its command was left running in the background. */
export const backgroundTaskId = (result: unknown) =>
	typeof result === 'object' &&
	result !== null &&
	'backgroundTaskId' in result &&
	typeof result.backgroundTaskId === 'string' &&
	result.backgroundTaskId !== ''
		? result.backgroundTaskId
		: undefined

/** Adds a shell the Bash tool left running in the background, titled by its description, else its command cut to one short line; `ownerId` is the subagent that ran it, if any. */
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
		type: clipTitle(oneLine(call.description || call.command)),
		description: call.description ? oneLine(call.command) : '',
		command: call.command,
		status: 'running',
		startedAt,
	})
