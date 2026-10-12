import type { AgentInfo, ToolCallInput } from 'claude-code'

import type { AgentRow } from '../types'

import {
	addRow,
	describeCall,
	FINISHED,
	oneLine,
	withActivity,
} from './activity'
import { hasBuffered, takeText } from './buffers'

/** Whether a tick has anything to do: a live agent or shell, text or an ending still waiting to be shown, or an agent not yet listed, finished or not. */
export const hasWork = (rows: AgentRow[], listed: AgentInfo[]) =>
	hasBuffered() ||
	[...rows, ...listed].some((agent) => !FINISHED.has(agent.status)) ||
	listed.some((info) => !rows.some((row) => row.id === info.id))

/** Adds a freshly spawned agent, typed and described as its Agent call named it. */
export const withSpawn = (
	rows: AgentRow[],
	agentId: string,
	spawn: { subagentType: string; description: string; prompt: string },
	startedAt: number,
	color?: string
) =>
	addRow(rows, {
		id: agentId,
		type: spawn.subagentType,
		description: spawn.description,
		prompt: oneLine(spawn.prompt),
		color,
		status: 'running',
		startedAt,
	})

/** Adds a subagent's tool call to its row, after any text it streamed just before it. */
export const withToolCall = (
	rows: AgentRow[],
	agentId: string,
	e: ToolCallInput
) => {
	const text = oneLine(takeText(agentId))
	const withText = (recent: string[]) =>
		text ? withActivity(recent, text) : recent

	return rows.map((row) =>
		row.id === agentId
			? {
					...row,
					recent: withActivity(withText(row.recent), describeCall(e.tool, e)),
				}
			: row
	)
}

/** Folds the engine's agent list, the drained text and ended tasks into the rows; an agent that runs again after finishing starts over as the newest. */
export const foldTick = (
	rows: AgentRow[],
	listed: AgentInfo[],
	drained: {
		text: Map<string, string>
		ended: Map<string, string>
		context: Map<string, number>
	},
	at: number
) =>
	listed
		.reduce((acc, info) => addRow(acc, { ...info, startedAt: at }), rows)
		.map((row) => {
			const statusOf = (id: string) =>
				listed.find((info) => info.id === id)?.status ??
				drained.ended.get(id) ??
				rows.find((known) => known.id === id)?.status
			const reported = statusOf(row.id) ?? row.status
			// A subagent's shell is ended with it and no notification follows, so the owner finishing is the only word.
			const ownerStatus = row.ownerId ? statusOf(row.ownerId) : undefined
			const isOrphaned =
				ownerStatus !== undefined &&
				FINISHED.has(ownerStatus) &&
				!FINISHED.has(reported)
			const status = isOrphaned ? 'killed' : reported
			const text = oneLine(drained.text.get(row.id) ?? '')
			const context = drained.context.get(row.id)
			const isRestarted = FINISHED.has(row.status) && !FINISHED.has(status)

			return {
				...row,
				status,
				startedAt: isRestarted ? at : row.startedAt,
				isArchived: isRestarted ? false : row.isArchived,
				endedAt: isRestarted
					? undefined
					: (row.endedAt ?? (FINISHED.has(status) ? at : undefined)),
				recent: text ? withActivity(row.recent, text) : row.recent,
				contextTokens: context ?? row.contextTokens,
			}
		})
		.toSorted((a, b) => a.startedAt - b.startedAt)
