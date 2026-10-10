import type {
	AgentInfo,
	SessionMessage,
	SessionMessagesDeny,
	ToolCallInput,
} from 'claude-code'

import type { AgentRow } from '../types'

import {
	addRow,
	describeCall,
	FINISHED,
	oneLine,
	withActivity,
} from './activity'

// Per-chunk writes stay out of atoms so streaming does not re-render; the tick folds them into rows.
const streamedText = new Map<string, string>()

/** Buffers a subagent's streamed text until the next tick or tool call shows it. */
export const bufferText = (agentId: string, text: string) =>
	streamedText.set(agentId, (streamedText.get(agentId) ?? '') + text)

/** Hands over everything streamed since the last tick, emptying the buffer. */
export const drainText = () => {
	const drained = new Map(streamedText)
	streamedText.clear()

	return drained
}

/** Whether a tick has anything to do: a live agent, text still waiting to be shown, or an agent not yet listed, finished or not. */
export const hasWork = (rows: AgentRow[], listed: AgentInfo[]) =>
	streamedText.size > 0 ||
	[...rows, ...listed].some((agent) => !FINISHED.has(agent.status)) ||
	listed.some((info) => !rows.some((row) => row.id === info.id))

/** Adds a freshly spawned agent, typed and described as its Agent call named it. */
export const withSpawn = (
	rows: AgentRow[],
	agentId: string,
	spawn: { subagentType: string; description: string },
	startedAt: number
) =>
	addRow(rows, {
		id: agentId,
		type: spawn.subagentType,
		description: spawn.description,
		status: 'running',
		startedAt,
	})

/** Adds a subagent's tool call to its row, after any text it streamed just before it. */
export const withToolCall = (
	rows: AgentRow[],
	agentId: string,
	e: ToolCallInput
) => {
	const text = oneLine(streamedText.get(agentId) ?? '')
	streamedText.delete(agentId)
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

/** Folds the engine's agent list and the drained text into the rows; an agent that runs again after finishing starts over as the newest. */
export const foldTick = (
	rows: AgentRow[],
	listed: AgentInfo[],
	drained: Map<string, string>,
	at: number
) =>
	listed
		.reduce((acc, info) => addRow(acc, { ...info, startedAt: at }), rows)
		.map((row) => {
			const status =
				listed.find((info) => info.id === row.id)?.status ?? row.status
			const text = oneLine(drained.get(row.id) ?? '')
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
			}
		})
		.toSorted((a, b) => a.startedAt - b.startedAt)

/** Turns an agent's transcript into the lines the pane shows: its prose and its tool calls. */
export const transcriptLines = (
	found: SessionMessage[] | SessionMessagesDeny
) =>
	'deny' in found
		? [`Transcript unavailable: ${found.deny}`]
		: found.flatMap((message) => [
				...(message.role === 'assistant' && message.text
					? [oneLine(message.text)]
					: []),
				...message.toolUses.map((use) => describeCall(use.tool, use.input)),
			])
