import type { AgentRow } from '../types'

import {
	DIFF_ADDED,
	DIFF_REMOVED,
	FINISHED,
	oneLine,
	TOOL_MARK,
} from './activity'
import { formatElapsed } from './format'
import { wrapLine } from './wrap-line'

const LABEL_WIDTH = 8
const STICKY_ROWS = 2
const REMOVED_COLOR = '#e06c75'
const ADDED_COLOR = '#98c379'
const MAX_DETAIL_CHARS = 240

const lineColor = (line: string, toolColor: string) => {
	if (line.startsWith(TOOL_MARK)) return toolColor
	if (line.startsWith(DIFF_REMOVED)) return REMOVED_COLOR
	if (line.startsWith(DIFF_ADDED)) return ADDED_COLOR
	return undefined
}

const clip = (text: string) => {
	const oneLined = oneLine(text)

	return oneLined.length > MAX_DETAIL_CHARS
		? `${oneLined.slice(0, MAX_DETAIL_CHARS)}…`
		: oneLined
}

const label = (name: string, value: string) =>
	`${name.padEnd(LABEL_WIDTH)}${clip(value)}`

/** The facts that stay pinned above the transcript: how long the agent has run and since when. */
export const stickyDetails = (row: AgentRow, now: number) => {
	const elapsed = formatElapsed(
		(row.endedAt ?? Math.max(now, row.startedAt)) - row.startedAt
	)

	return [
		label(
			'Status',
			`${row.status}${FINISHED.has(row.status) ? ' after' : ' for'} ${elapsed}`
		),
		label('Started', new Date(row.startedAt).toLocaleTimeString()),
	]
}

/** What an agent or shell is beyond the pinned facts: the ones the list row has no room for. */
const scrollingDetails = (row: AgentRow) => {
	const details: [string, string | undefined][] = [
		['Task', row.prompt || row.description],
		['Command', row.kind === 'shell' ? row.command : undefined],
		['Id', row.id],
	]

	return details.flatMap(([name, value]) => (value ? [label(name, value)] : []))
}

/** The rows an open agent's body has under the divider and the back button. */
export const visibleTranscriptRows = (bodyRows: number, treeRows: number) =>
	Math.max(1, bodyRows - treeRows - 2 - STICKY_ROWS)

/** Every row the open agent shows, details first: scrolling moves by these rows, never by whole messages. Each transcript line leads with its number, so the order of the agent's steps reads at a glance. */
export const transcriptRows = (
	row: AgentRow,
	lines: string[],
	now: number,
	columns: number
) => {
	const gutterWidth = `${lines.length}`.length + 1
	const blank = ' '.repeat(gutterWidth)

	return [
		...scrollingDetails(row).flatMap((line) =>
			wrapLine(line, columns).map((text) => ({
				gutter: '',
				text,
				color: undefined,
				isDim: true,
			}))
		),
		...lines.flatMap((line, index) =>
			wrapLine(line, columns - gutterWidth).map((text, part) => ({
				gutter:
					part === 0 ? `${index + 1}`.padStart(gutterWidth - 1) + ' ' : blank,
				text,
				color: lineColor(line, row.color),
				isDim: false,
			}))
		),
	]
}
