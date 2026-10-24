import type { RenderNode } from 'claude-code'

import type { AgentRow } from '../types'

import { drawAgentList } from './agent-list'
import { listedRows } from './archive'
import type { ArchiveControls } from './archive-bar'
import type { DockElements } from './elements'
import { SCROLLBAR_COLUMNS } from './scrollbar'
import { visibleTranscriptRows } from './transcript-rows'
import { drawTranscript } from './transcript-view'

export type SplitPaneProps = {
	ui: DockElements
	rows: AgentRow[]
	opened: { row: AgentRow; lines: string[] } | undefined
	now: number
	phase: number
	bodyRows: number
	bodyColumns: number
	treeRows: number
	offset: number
	archive: ArchiveControls
	isCollapsed: boolean
	toggleCollapsed: () => void
	select: (id: string | null) => () => void
	header: RenderNode
}

/** Draws the host pane's own tree in the top half and the session's agents below it; without a host the agents take the whole pane. */
export const splitPane = ({
	ui,
	rows,
	opened,
	now,
	phase,
	bodyRows,
	bodyColumns,
	treeRows,
	offset,
	archive,
	isCollapsed,
	toggleCollapsed,
	select,
	header,
}: SplitPaneProps) => {
	const { Box } = ui

	return (
		<Box flexDirection="column" height={bodyRows}>
			{header}
			<Box flexDirection="column" height={bodyRows - treeRows - 1}>
				{opened
					? drawTranscript({
							ui,
							...opened,
							now,
							offset,
							visibleRows: visibleTranscriptRows(bodyRows, treeRows),
							columns: bodyColumns - SCROLLBAR_COLUMNS,
							isCollapsed,
							toggleCollapsed,
							select,
						})
					: drawAgentList({
							ui,
							listed: listedRows(rows, archive.isOpen),
							offset,
							rows,
							height: bodyRows - treeRows - 1,
							archive,
							now,
							phase,
							select,
						})}
			</Box>
		</Box>
	)
}
