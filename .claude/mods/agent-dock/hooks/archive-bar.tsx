import type { AgentRow } from '../types'

import { FINISHED } from './activity'
import type { DockElements } from './elements'

export type ArchiveControls = {
	isOpen: boolean
	toggle: () => void
	archiveFinished: () => void
}

/** The rows the archive bar takes under the list: none when there is nothing to archive or show, else its margin and its row. */
export const archiveBarRows = (rows: AgentRow[]) =>
	rows.some((row) => row.isArchived || FINISHED.has(row.status)) ? 2 : 0

/** The row pinned under the agent list: the archive's count, which opens and closes it, and a control to archive every finished agent. */
export const drawArchiveBar = (
	ui: DockElements,
	rows: AgentRow[],
	archive: ArchiveControls
) => {
	const { Box, Text, Button } = ui
	const archived = rows.filter((row) => row.isArchived).length
	const finished = rows.filter(
		(row) => !row.isArchived && FINISHED.has(row.status)
	).length
	if (archived === 0 && finished === 0) return undefined

	return (
		<Box
			key="archive"
			flexDirection="row"
			flexShrink={0}
			justifyContent="space-between"
			marginTop={1}
		>
			<Button key="archive:toggle" plain onPress={archive.toggle}>
				<Text dimColor>
					{archive.isOpen ? '▾' : '▸'} Archived ({archived})
				</Text>
			</Button>
			{finished > 0 && (
				<Button
					key="archive:finished"
					plain
					dimColor
					onPress={archive.archiveFinished}
				>
					{`archive ${finished} finished`}
				</Button>
			)}
		</Box>
	)
}
