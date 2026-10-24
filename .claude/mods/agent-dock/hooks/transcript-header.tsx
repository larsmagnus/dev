import type { AgentRow } from '../types'

import { rowTitle } from './activity'
import type { DockElements } from './elements'

export type TranscriptHeaderProps = {
	ui: DockElements
	row: AgentRow
	isCollapsed: boolean
	toggleCollapsed: () => void
	back: () => void
}

/** The back button, which gives way when the title is long, and the toggle that folds every tool call to one line, at the right end. */
export const drawTranscriptHeader = ({
	ui,
	row,
	isCollapsed,
	toggleCollapsed,
	back,
}: TranscriptHeaderProps) => {
	const { Box, Text, Button } = ui

	return (
		<Box flexDirection="row" justifyContent="space-between">
			<Box flexShrink={1} overflow="hidden">
				<Button key="back" plain onPress={back}>
					<Text color={row.color} bold>
						← {rowTitle(row)}
					</Text>
					{row.description !== '' && <Text dimColor> {row.description}</Text>}
				</Button>
			</Box>
			<Button key="collapse" plain dimColor onPress={toggleCollapsed}>
				{isCollapsed ? '⊞' : '⊟'}
			</Button>
		</Box>
	)
}
