import type { RenderNode } from 'claude-code'

import type { AgentRow } from '../types'

import { FINISHED } from './activity'
import { drawAgentRow } from './agent-row'
import { listedRows } from './archive'
import type { ArchiveControls } from './archive-bar'
import { drawArchiveBar } from './archive-bar'
import type { DividerProps } from './divider'
import type { DockElements } from './elements'
import { drawTranscript } from './transcript-view'

export type SplitPaneProps = {
	ui: DockElements
	tree?: RenderNode
	rows: AgentRow[]
	opened: { row: AgentRow; lines: string[] } | undefined
	now: number
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
	bodyRows,
	bodyColumns,
	treeRows: requestedTreeRows,
	offset,
	archive,
	select,
}: SplitPaneProps) => {
	const { Box, Client } = ui
	const treeRows = tree === undefined ? 0 : requestedTreeRows
	const running = rows.filter((row) => !FINISHED.has(row.status)).length

	const agentRow = (row: AgentRow) => drawAgentRow({ ui, row, now, select })

	/** Shows the tail of an agent's transcript under a back button, so the newest lines stay visible. */
	return (
		<Box flexDirection="column" height={bodyRows}>
			{tree !== undefined && (
				<Box flexDirection="column" height={treeRows} overflow="hidden">
					{tree}
				</Box>
			)}
			<Client
				key="divider"
				module="./divider.tsx"
				props={
					{
						label: `Agents (${running} running, ${rows.length} total)`,
						columns: bodyColumns,
						bodyRows,
					} satisfies DividerProps
				}
			/>
			<Box flexDirection="column" height={bodyRows - treeRows - 1}>
				<Box flexDirection="column" flexGrow={1} overflow="hidden">
					{opened
						? drawTranscript({
								ui,
								...opened,
								offset,
								visibleRows: bodyRows - treeRows - 2,
								columns: bodyColumns,
								select,
							})
						: listedRows(rows, archive.isOpen).slice(offset).map(agentRow)}
				</Box>
				{!opened && drawArchiveBar(ui, rows, archive)}
			</Box>
		</Box>
	)
}
