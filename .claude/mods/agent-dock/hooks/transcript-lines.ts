import type { SessionMessage, SessionMessagesDeny } from 'claude-code'

import { describeCall, describeEdits, oneLine } from './activity'

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
				...message.toolUses.flatMap((use) => [
					describeCall(use.tool, use.input),
					...describeEdits(use.tool, use.input),
				]),
			])
