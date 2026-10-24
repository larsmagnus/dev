import { DIFF_ADDED, DIFF_REMOVED, TOOL_MARK } from './activity'
import { RESULT_ERROR_MARK, RESULT_MARK } from './tool-output'

const REMOVED_COLOR = '#e06c75'
const ADDED_COLOR = '#98c379'

export type RowPart = {
	text: string
	color?: string
	isBold?: boolean
	isDim?: boolean
}

// The API's own failures arrive as plain assistant text, with no error flag to read.
const API_ERROR =
	/^API Error|hit your session limit|rate_limit|overloaded_error/i

const isProse = (line: string) =>
	/^\S/.test(line) && !line.startsWith(TOOL_MARK)

const lineColor = (line: string) => {
	if (line.startsWith(RESULT_ERROR_MARK)) return REMOVED_COLOR
	if (isProse(line) && API_ERROR.test(line)) return REMOVED_COLOR
	if (line.startsWith(DIFF_REMOVED)) return REMOVED_COLOR
	if (line.startsWith(DIFF_ADDED)) return ADDED_COLOR
	return undefined
}

/** A call's bullet takes the agent's color, its name stands out and its arguments recede; rows a long call wraps onto recede whole. */
const callParts = (text: string, color: string, isFirst: boolean) => {
	if (!isFirst) return [{ text, isDim: true }]
	const call = text.slice(TOOL_MARK.length)
	const argsAt = call.includes('(') ? call.indexOf('(') : call.length

	return [
		{ text: TOOL_MARK, color },
		{ text: call.slice(0, argsAt), isBold: true },
		{ text: call.slice(argsAt), isDim: true },
	]
}

/** The styled pieces of one wrapped row of a transcript line. */
export const rowParts = (
	line: string,
	text: string,
	part: number,
	agentColor: string
): RowPart[] => {
	if (line.startsWith(TOOL_MARK)) return callParts(text, agentColor, part === 0)

	return [
		{
			// An error reads as the main session shows it: the result's own mark, in red.
			text: text.replace(RESULT_ERROR_MARK, RESULT_MARK),
			color: lineColor(line),
			isDim: line.startsWith(RESULT_MARK),
		},
	]
}
