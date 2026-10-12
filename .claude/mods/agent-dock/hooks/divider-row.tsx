import type { AgentRow } from '../types'

import { FINISHED } from './activity'
import type { DividerProps } from './divider'
import type { DockElements } from './elements'

/** The rule between the host's tree and the agents, labelled with how many agents are running and how many there are. */
export const drawDividerRow = (
	ui: DockElements,
	rows: AgentRow[],
	size: { columns: number; bodyRows: number }
) => {
	const { Client } = ui
	const running = rows.filter((row) => !FINISHED.has(row.status)).length

	return (
		<Client
			key="divider"
			module="./divider.tsx"
			props={
				{
					label: `Agents (${running} running, ${rows.length} total)`,
					...size,
				} satisfies DividerProps
			}
		/>
	)
}
