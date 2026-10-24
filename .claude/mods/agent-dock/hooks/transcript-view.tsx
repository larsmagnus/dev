import type { AgentRow } from '../types'

import type { DockElements } from './elements'
import { drawScrollbar } from './scrollbar'
import { drawTranscriptHeader } from './transcript-header'
import { drawTranscriptRow } from './transcript-row-view'
import { stickyDetails, transcriptRows } from './transcript-rows'

export type TranscriptViewProps = {
	ui: DockElements
	row: AgentRow
	now: number
	lines: string[]
	offset: number
	visibleRows: number
	columns: number
	isCollapsed: boolean
	toggleCollapsed: () => void
	select: (id: string | null) => () => void
}

/** Shows what an agent or shell is, then its transcript, as one run of rows under a back button; the run ends `offset` rows above its newest. */
export const drawTranscript = ({
	ui,
	row,
	now,
	lines,
	offset,
	visibleRows,
	columns,
	isCollapsed,
	toggleCollapsed,
	select,
}: TranscriptViewProps) => {
	const { Box, Text } = ui
	const all = transcriptRows(row, lines, now, columns, isCollapsed)
	const hiddenAbove = Math.max(0, all.length - visibleRows)
	const end = all.length - Math.min(offset, hiddenAbove)

	return (
		<Box flexDirection="column" flexGrow={1} overflow="hidden">
			{drawTranscriptHeader({
				ui,
				row,
				isCollapsed,
				toggleCollapsed,
				back: select(null),
			})}
			{stickyDetails(row, now).map((line) => (
				<Text key={line} wrap="truncate-end" dimColor>
					{line}
				</Text>
			))}
			<Box flexDirection="row">
				<Box flexDirection="column" flexGrow={1}>
					{all
						.slice(Math.max(0, end - visibleRows), end)
						.map((shown) => drawTranscriptRow(ui, shown))}
				</Box>
				{drawScrollbar({
					ui,
					total: all.length,
					visible: visibleRows,
					start: end - visibleRows,
				})}
			</Box>
		</Box>
	)
}
