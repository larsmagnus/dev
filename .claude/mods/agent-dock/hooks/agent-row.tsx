import type { AgentRow } from '../types'

import { FINISHED, formatElapsed, TOOL_MARK } from './activity'
import type { DockElements } from './elements'
import type { PulseDotProps } from './pulse-dot'

export type AgentRowProps = {
	ui: DockElements
	row: AgentRow
	now: number
	select: (id: string | null) => () => void
}

/** Renders one agent as a selectable header with its live activity lines under it. */
export const drawAgentRow = ({ ui, row, now, select }: AgentRowProps) => {
	const { Box, Text, Button, Client } = ui

	return (
		<Box key={row.id} flexDirection="column">
			<Box flexDirection="row">
				<Client
					key={`dot:${row.id}`}
					module="./pulse-dot.tsx"
					props={
						{
							color: row.color,
							isActive: row.status === 'running',
						} satisfies PulseDotProps
					}
				/>
				<Button key={`open:${row.id}`} plain onPress={select(row.id)}>
					<Text color={row.color} bold>
						{' '}
						{row.type}
					</Text>
					<Text dimColor>
						{' '}
						{row.status} (
						{formatElapsed(
							(row.endedAt ?? Math.max(now, row.startedAt)) - row.startedAt
						)}
						)
					</Text>
					<Text dimColor={FINISHED.has(row.status)}> {row.description}</Text>
				</Button>
			</Box>
			{row.recent.map((line) => (
				<Text
					dimColor
					wrap={line.startsWith(TOOL_MARK) ? 'truncate-end' : 'truncate-start'}
				>
					{' '}
					{line}
				</Text>
			))}
		</Box>
	)
}
