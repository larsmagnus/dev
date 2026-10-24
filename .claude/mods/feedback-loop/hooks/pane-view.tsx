import type { Elements } from 'claude-code'

import type { Suggestion } from '../types'

import { suggestionRow } from './suggestion-row'

type PaneElements = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'> &
	Partial<Pick<Elements['terminal'], 'Input'>>

export interface PaneHandlers {
	toggle: (key: string) => () => void
	type: (value: string) => void
	apply: () => void
	decline: () => void
	run: () => void
	refresh: () => void
	enableSchedule: () => void
}

export interface PaneModel {
	waiting: Suggestion[]
	ticked: string[]
	correction: string
	busy: string | null
	isScheduled: boolean
	report: string[]
}

/** Builds the review pane; the correction field is omitted on surfaces without an input, where the ticks still work. */
export function paneView(
	ui: PaneElements,
	model: PaneModel,
	handlers: PaneHandlers
) {
	const { Box, Text, Button, Input } = ui
	const count = model.ticked.length

	return (
		<Box flexDirection="column" gap={1}>
			{model.report.length > 0 && (
				<Box flexDirection="column" borderStyle="round" paddingX={1}>
					{model.report.map((line, i) => (
						<Text key={`report:${i}`} bold={i === 0}>
							{line}
						</Text>
					))}
				</Box>
			)}
			{model.waiting.length === 0 && (
				<Text dimColor>Nothing pending review.</Text>
			)}
			{model.waiting.map((item) =>
				suggestionRow(
					ui,
					item,
					model.ticked.includes(item.key),
					handlers.toggle(item.key)
				)
			)}
			{Input && (
				<Input
					key="correction"
					label="Corrections"
					placeholder="Free text applied to the ticked suggestions"
					rows={2}
					value={model.correction}
					submitLabel="apply"
					onInput={handlers.type}
					onSubmit={handlers.apply}
				/>
			)}
			{model.busy !== null && <Text color="warning">{model.busy}</Text>}
			{!model.isScheduled && (
				<Button
					key="schedule"
					label="Enable weekly run"
					onPress={handlers.enableSchedule}
				/>
			)}
			<Box gap={2}>
				<Button key="apply" label={`Apply ${count}`} onPress={handlers.apply} />
				<Button
					key="decline"
					label={`Decline ${count}`}
					onPress={handlers.decline}
				/>
				<Button key="run" label="Run now" onPress={handlers.run} />
				<Button key="refresh" label="Refresh" onPress={handlers.refresh} />
			</Box>
		</Box>
	)
}
