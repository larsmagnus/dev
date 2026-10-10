import type { AgentRow } from '../types'

import { TOOL_MARK } from './activity'
import type { DockElements } from './elements'

export type TranscriptViewProps = {
	ui: DockElements
	row: AgentRow
	lines: string[]
	offset: number
	visibleRows: number
	columns: number
	select: (id: string | null) => () => void
}

/** The newest lines that fit `rows` once each wraps at `columns`, so the tail is never pushed out of view. */
const tailThatFits = (lines: string[], rows: number, columns: number) => {
	const height = (line: string) =>
		Math.max(1, Math.ceil(line.length / Math.max(1, columns)))
	const kept: string[] = []
	for (
		let used = 0, at = lines.length - 1;
		at >= 0 && used + height(lines[at] ?? '') <= rows;
		at -= 1
	) {
		used += height(lines[at] ?? '')
		kept.unshift(lines[at] ?? '')
	}
	return kept
}

/** Shows an agent's transcript under a back button, ending `offset` lines above its newest, each line wrapped. */
export const drawTranscript = ({
	ui,
	row,
	lines,
	offset,
	visibleRows,
	columns,
	select,
}: TranscriptViewProps) => {
	const { Box, Text, Button } = ui

	return (
		<Box flexDirection="column">
			<Button key="back" plain onPress={select(null)}>
				<Text color={row.color} bold>
					← {row.type}
				</Text>
				<Text dimColor> {row.description}</Text>
			</Button>
			{tailThatFits(
				lines.slice(0, lines.length - offset),
				visibleRows,
				columns
			).map((line) => (
				<Text
					wrap="wrap"
					color={line.startsWith(TOOL_MARK) ? row.color : undefined}
				>
					{line}
				</Text>
			))}
		</Box>
	)
}
