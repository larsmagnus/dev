import type { AgentRow } from '../types'

import { clipTitle } from './activity'
import type { DockElements } from './elements'
import { drawScrollbar } from './scrollbar'
import { transcriptRows } from './transcript-rows'

export type TranscriptViewProps = {
	ui: DockElements
	row: AgentRow
	now: number
	lines: string[]
	offset: number
	visibleRows: number
	columns: number
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
	select,
}: TranscriptViewProps) => {
	const { Box, Text, Button } = ui
	const all = transcriptRows(row, lines, now, columns)
	const hiddenAbove = Math.max(0, all.length - visibleRows)
	const end = all.length - Math.min(offset, hiddenAbove)

	return (
		<Box flexDirection="column" flexGrow={1} overflow="hidden">
			<Button key="back" plain onPress={select(null)}>
				<Text color={row.color} bold>
					← {clipTitle(row.type)}
				</Text>
				{row.kind === 'shell' && <Text dimColor> (shell)</Text>}
				<Text dimColor> {row.description}</Text>
			</Button>
			<Box flexDirection="row">
				<Box flexDirection="column" flexGrow={1}>
					{all.slice(Math.max(0, end - visibleRows), end).map((shown) => (
						<Text
							wrap="truncate-end"
							dimColor={shown.isDim}
							color={shown.color}
						>
							{shown.text}
						</Text>
					))}
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
