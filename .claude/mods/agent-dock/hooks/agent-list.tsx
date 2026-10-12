import type { AgentRow } from '../types'

import { agentRowHeight, drawAgentRow } from './agent-row'
import type { ArchiveControls } from './archive-bar'
import { archiveBarRows, drawArchiveBar } from './archive-bar'
import type { DockElements } from './elements'
import { drawScrollbar } from './scrollbar'

export type AgentListProps = {
	ui: DockElements
	rows: AgentRow[]
	listed: AgentRow[]
	offset: number
	height: number
	archive: ArchiveControls
	now: number
	phase: number
	select: (id: string | null) => () => void
}

const heightOf = (entries: AgentRow[]) =>
	entries.reduce((sum, row) => sum + agentRowHeight(row), 0)

/** The agent list from its `offset`th entry with a scrollbar beside it sized in rows, since entries are taller than one row, and the archive bar pinned under it; `height` is the room for both. */
export const drawAgentList = ({
	ui,
	rows,
	listed,
	offset,
	height,
	archive,
	now,
	phase,
	select,
}: AgentListProps) => {
	const { Box } = ui
	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box flexDirection="row" flexGrow={1} overflow="hidden">
				<Box flexDirection="column" flexGrow={1} overflow="hidden">
					{listed
						.slice(offset)
						.map((row) => drawAgentRow({ ui, row, now, phase, select }))}
				</Box>
				{drawScrollbar({
					ui,
					total: heightOf(listed),
					visible: height - archiveBarRows(rows),
					start: heightOf(listed.slice(0, offset)),
				})}
			</Box>
			{drawArchiveBar(ui, rows, archive)}
		</Box>
	)
}
