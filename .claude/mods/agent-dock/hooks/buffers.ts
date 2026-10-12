import { FINISHED } from './activity'

// Per-chunk writes stay out of atoms so streaming does not re-render; the tick folds them into rows.
const streamedText = new Map<string, string>()
// A task notification is the only word a background shell gives that it ended; the draw that sees it cannot write state, so the tick folds it.
const endedTasks = new Map<string, string>()
const latestContext = new Map<string, number>()

/** Buffers a subagent's streamed text until the next tick or tool call shows it. */
export const bufferText = (agentId: string, text: string) =>
	streamedText.set(agentId, (streamedText.get(agentId) ?? '') + text)

/** Hands over everything streamed and every task ended since the last tick, emptying the buffers. */
export const drainBuffers = () => {
	const drained = {
		text: new Map(streamedText),
		ended: new Map(endedTasks),
		context: new Map(latestContext),
	}
	streamedText.clear()
	endedTasks.clear()
	latestContext.clear()

	return drained
}

/** Keeps an agent's newest context size, as its latest response's prompt reported it, until the next tick. */
export const bufferUsage = (
	agentId: string,
	usage: {
		input_tokens: number
		cache_read_input_tokens: number
		cache_creation_input_tokens: number
	}
) =>
	latestContext.set(
		agentId,
		usage.input_tokens +
			usage.cache_read_input_tokens +
			usage.cache_creation_input_tokens
	)

/** Buffers how a background task ended, as its notification said, until the next tick. */
export const bufferTaskEnd = (taskId: string, status: string) =>
	endedTasks.set(taskId, FINISHED.has(status) ? status : 'completed')

/** Whether anything is buffered, so a tick has text, an ending or a context size to show. */
export const hasBuffered = () =>
	streamedText.size > 0 || endedTasks.size > 0 || latestContext.size > 0

/** Takes the text an agent streamed since it was last shown, emptying it. */
export const takeText = (agentId: string) => {
	const text = streamedText.get(agentId) ?? ''
	streamedText.delete(agentId)

	return text
}
