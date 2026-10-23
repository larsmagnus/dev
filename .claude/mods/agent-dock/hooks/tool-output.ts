import type { ToolUseSummary } from 'claude-code'

import { oneLine } from './activity'

export const RESULT_MARK = '  ⎿ '
export const RESULT_ERROR_MARK = '  ✗ '

const MAX_RESULT_LINES = 3
const MAX_RESULT_CHARS = 160

/** Shows the first lines of what a call returned, dimmed under it; an error is marked instead. Edits and the handback show their own outcome. */
export const describeResult = (
	use: Pick<ToolUseSummary, 'tool' | 'text' | 'isError'>
) => {
	const isQuiet = ['Edit', 'MultiEdit', 'SubagentHandback'].includes(use.tool)
	if (isQuiet && !use.isError) return []
	const lines = (use.text ?? '')
		.split('\n')
		.map((line) => oneLine(line).slice(0, MAX_RESULT_CHARS))
		.filter(Boolean)
	const mark = use.isError ? RESULT_ERROR_MARK : RESULT_MARK
	const shown = lines.slice(0, MAX_RESULT_LINES).map((line) => mark + line)

	return lines.length > MAX_RESULT_LINES ? [...shown, `${mark}…`] : shown
}

/** The report a subagent handed back, line for line, so none of it is flattened away. */
export const describeHandback = (tool: string, input: unknown) => {
	if (tool !== 'SubagentHandback') return []
	const message = new Map(Object.entries(input ?? {})).get('message')

	return typeof message === 'string' ? message.trimEnd().split('\n') : []
}
