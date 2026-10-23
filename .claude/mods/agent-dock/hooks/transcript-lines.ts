import type { SessionMessage, SessionMessagesDeny } from 'claude-code'

import { describeCall, describeEdits, oneLine } from './activity'
import { describeHandback, describeResult } from './tool-output'

/** Turns an agent's transcript into the lines the pane shows: its prose, its tool calls with what they returned, and the report it handed back. */
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
					...describeResult(use),
					...describeHandback(use.tool, use.input),
				]),
			])
