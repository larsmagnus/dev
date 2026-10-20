import type { RenderNode } from 'claude-code'

import type { AgentRow } from '../types'

import { FINISHED } from './activity'
import type { DividerProps } from './divider'
import type { DockElements } from './elements'

export type LayoutToggle = { label: string; press: () => void }

/** The rule between the host's tree and the agents, labelled with how many agents are running and how many there are, with the layout toggle at its right end when there is one. */
const drawDividerRow = (
	ui: DockElements,
	rows: AgentRow[],
	size: { columns: number; bodyRows: number },
	toggle?: LayoutToggle
) => {
	const { Box, Button, Client } = ui
	const running = rows.filter((row) => !FINISHED.has(row.status)).length

	return (
		<Box key="divider-row" flexDirection="row">
			<Client
				key="divider"
				module="./divider.tsx"
				props={
					{
						label: `Agents (${running} running, ${rows.length} total)`,
						...size,
						columns: size.columns - (toggle?.label.length ?? 0),
					} satisfies DividerProps
				}
			/>
			{toggle && (
				<Button key="layout:toggle" plain dimColor onPress={toggle.press}>
					{toggle.label}
				</Button>
			)}
		</Box>
	)
}

/** The host's tree, when there is one, over the divider that separates it from the agents. */
export const drawDockHeader = (
	ui: DockElements,
	rows: AgentRow[],
	size: { columns: number; bodyRows: number },
	toggle: LayoutToggle | undefined,
	tree: { node?: RenderNode; rows: number }
) => {
	const { Box } = ui

	return (
		<Box key="header" flexDirection="column" flexShrink={0}>
			{tree.node && (
				<Box flexDirection="column" height={tree.rows} overflow="hidden">
					{tree.node}
				</Box>
			)}
			{drawDividerRow(ui, rows, size, toggle)}
		</Box>
	)
}
