import type { RenderNode } from 'claude-code'

import type { AgentRow } from '../types'

import { drawAgentList } from './agent-list'
import { listedRows } from './archive'
import type { ArchiveControls } from './archive-bar'
import { drawDividerRow } from './divider-row'
import type { DockElements } from './elements'
import { SCROLLBAR_COLUMNS } from './scrollbar'
import { visibleTranscriptRows } from './transcript-rows'
import { drawTranscript } from './transcript-view'

export type SplitPaneProps = {
	ui: DockElements
	tree?: RenderNode
	rows: AgentRow[]
	opened: { row: AgentRow; lines: string[] } | undefined
	now: number
	phase: number
	bodyRows: number
	bodyColumns: number
	treeRows: number
	offset: number
	archive: ArchiveControls
	select: (id: string | null) => () => void
}

/** Draws the host pane's own tree in the top half and the session's agents below it; without a host the agents take the whole pane. */
export const splitPane = ({
	ui,
	tree,
	rows,
	opened,
	now,
	phase,
	bodyRows,
	bodyColumns,
	treeRows: requestedTreeRows,
	offset,
	archive,
	select,
}: SplitPaneProps) => {
	const { Box } = ui
	const treeRows = tree === undefined ? 0 : requestedTreeRows

	return (
		<Box flexDirection="column" height={bodyRows}>
			{tree !== undefined && (
				<Box flexDirection="column" height={treeRows} overflow="hidden">
					{tree}
				</Box>
			)}
			{drawDividerRow(ui, rows, { columns: bodyColumns, bodyRows })}
			<Box flexDirection="column" height={bodyRows - treeRows - 1}>
				{opened
					? drawTranscript({
							ui,
							...opened,
							now,
							offset,
							visibleRows: visibleTranscriptRows(bodyRows, treeRows),
							columns: bodyColumns - SCROLLBAR_COLUMNS,
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
