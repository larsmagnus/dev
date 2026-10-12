import type { AgentRow } from '../types'

import { describeCall, rowTitle, TOOL_MARK } from './activity'
import type { DockElements } from './elements'
import { formatElapsed, formatTokens, statusColor } from './format'
import { shimmerColor } from './shimmer'

export type AgentRowProps = {
	ui: DockElements
	row: AgentRow
	now: number
	phase: number
	select: (id: string | null) => () => void
}

/** The numbers after the status: elapsed time, then the size of the agent's context once it has reported one. */
const statsOf = (row: AgentRow, now: number) => {
	const elapsed = formatElapsed(
		(row.endedAt ?? Math.max(now, row.startedAt)) - row.startedAt
	)

	return row.contextTokens === undefined
		? `(${elapsed})`
		: `(${elapsed}) · ctx ${formatTokens(row.contextTokens)}`
}

/** The dim lines under an entry: an agent's latest activity, or a shell's command, which is its whole story. */
const activityOf = (row: AgentRow) =>
	row.kind === 'shell' && row.command
		? [describeCall('Bash', { command: row.command })]
		: row.recent

/** How many rows an agent's entry takes: its title, its description when it has one, and its activity lines. */
export const agentRowHeight = (row: AgentRow) =>
	1 + (row.description === '' ? 0 : 1) + activityOf(row).length

/** Renders one agent as a selectable title button, its description, and its live activity lines. */
export const drawAgentRow = ({
	ui,
	row,
	now,
	phase,
	select,
}: AgentRowProps) => {
	const { Box, Text, Button } = ui
	const isActive = row.status === 'running'
	// Rows kept from before a title was clipped, or restored from the store, are cut here too.
	const name = Array.from(`● ${rowTitle(row)}`)
	const color = statusColor(row.status)

	return (
		<Box key={row.id} flexDirection="column" flexShrink={0}>
			<Box flexDirection="row" flexShrink={0} height={1} overflow="hidden">
				<Button key={`open:${row.id}`} plain onPress={select(row.id)}>
					{name.map((char, at) => (
						<Text
							bold
							color={
								isActive
									? shimmerColor(at, phase, name.length, row.color)
									: row.color
							}
						>
							{char}
						</Text>
					))}
					<Text color={color} dimColor={color === undefined}>
						{' '}
						{row.status}
					</Text>
					<Text dimColor> {statsOf(row, now)}</Text>
				</Button>
			</Box>
			{row.description !== '' && (
				<Text wrap="truncate-end"> {row.description}</Text>
			)}
			{activityOf(row).map((line) => (
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
