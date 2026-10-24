import type { AgentRow } from '../types'

import { FINISHED, TOOL_MARK, oneLine } from './activity'
import { formatElapsed } from './format'
import { rowParts } from './transcript-parts'
import type { RowPart } from './transcript-parts'
import { wrapLine } from './wrap-line'

const LABEL_WIDTH = 8
const STICKY_ROWS = 2
const MAX_DETAIL_CHARS = 240

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

/** Every row the open agent shows, details first: scrolling moves by these rows, never by whole messages. Each transcript line leads with its number, so the order of the agent's steps reads at a glance; a call gets a blank row above it, and a collapsed call keeps to one row. */
export const transcriptRows = (
	row: AgentRow,
	lines: string[],
	now: number,
	columns: number,
	isCollapsed = false
) => {
	const gutterWidth = `${lines.length}`.length + 1
	const blank = ' '.repeat(gutterWidth)

	return [
		...scrollingDetails(row).flatMap((line) =>
			wrapLine(line, columns).map((text) => {
				const parts: RowPart[] = [{ text, isDim: true }]

				return { gutter: '', parts }
			})
		),
		...lines.flatMap((line, index) => {
			const isCall = line.startsWith(TOOL_MARK)
			const texts =
				isCall && isCollapsed ? [line] : wrapLine(line, columns - gutterWidth)
			const spacer = isCall && !isCollapsed && index > 0
			const rows = texts.map((text, part) => ({
				gutter:
					part === 0 ? `${index + 1}`.padStart(gutterWidth - 1) + ' ' : blank,
				parts: rowParts(line, text, part, row.color),
			}))

			return spacer ? [{ gutter: blank, parts: [] }, ...rows] : rows
		}),
	]
}
