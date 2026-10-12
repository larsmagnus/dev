import type { AgentRow } from '../types'

import {
	DIFF_ADDED,
	DIFF_REMOVED,
	FINISHED,
	oneLine,
	TOOL_MARK,
} from './activity'
import { formatElapsed } from './format'

const LABEL_WIDTH = 8
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

/** What an agent or shell is, as labelled lines: the facts the list row has no room for. */
const rowDetails = (row: AgentRow, now: number) => {
	const elapsed = formatElapsed(
		(row.endedAt ?? Math.max(now, row.startedAt)) - row.startedAt
	)
	const details: [string, string | undefined][] = [
		[
			'Status',
			`${row.status}${FINISHED.has(row.status) ? ' after' : ' for'} ${elapsed}`,
		],
		['Started', new Date(row.startedAt).toLocaleTimeString()],
		['Task', row.kind === 'shell' ? undefined : row.prompt || row.description],
		['Command', row.kind === 'shell' ? row.command : undefined],
		['Id', row.id],
	]

	return details.flatMap(([label, value]) =>
		value ? [`${label.padEnd(LABEL_WIDTH)}${clip(value)}`] : []
	)
}

/** The rows an open agent's body has under the divider and the back button. */
export const visibleTranscriptRows = (bodyRows: number, treeRows: number) =>
	Math.max(1, bodyRows - treeRows - 2)

/** Breaks a line into rows of at most `columns`: at spaces where it can, mid-word where a word is wider than a row; leading indent is kept. */
const wrapLine = (line: string, columns: number) => {
	const width = Math.max(1, columns)
	const indent = /^ */.exec(line)?.[0] ?? ''
	const rows: string[] = []
	let current = indent
	let hasWord = false
	for (const word of line.slice(indent.length).split(' ')) {
		const joined = hasWord ? `${current} ${word}` : `${current}${word}`
		if (joined.length <= width) {
			current = joined
			hasWord = true
			continue
		}

		let rest = hasWord ? word : joined
		if (hasWord) rows.push(current)
		while (rest.length > width) {
			rows.push(rest.slice(0, width))
			rest = rest.slice(width)
		}
		current = rest
		hasWord = true
	}

	return [...rows, current]
}

/** Every row the open agent shows, details first: scrolling moves by these rows, never by whole messages. */
export const transcriptRows = (
	row: AgentRow,
	lines: string[],
	now: number,
	columns: number
) => [
	...rowDetails(row, now).flatMap((line) =>
		wrapLine(line, columns).map((text) => ({
			text,
			color: undefined,
			isDim: true,
		}))
	),
	...lines.flatMap((line) =>
		wrapLine(line, columns).map((text) => ({
			text,
			color: lineColor(line, row.color),
			isDim: false,
		}))
	),
]
