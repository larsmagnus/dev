import type { Suggestion } from '../types'

import type { PaneElements } from './report-box'
import { reportBox } from './report-box'
import { suggestionRow } from './suggestion-row'

export interface PaneHandlers {
	toggle: (key: string) => () => void
	type: (value: string) => void
	apply: () => void
	decline: () => void
	run: () => void
	refresh: () => void
	dismissReport: () => void
	enableSchedule: () => void
}

export interface PaneModel {
	waiting: Suggestion[]
	ticked: string[]
	correction: string
	busy: string | null
	isScheduled: boolean
	lastRun: number | null
	report: string[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const sameDay = (a: number, b: number) =>
	new Date(a).toDateString() === new Date(b).toDateString()

/** Names today and yesterday in words, since "Yesterday" is faster to read than a date; older runs show the full date. */
function lastReview(at: number, now: number) {
	const time = new Date(at).toLocaleTimeString([], { timeStyle: 'short' })
	if (sameDay(at, now)) return `Today, ${time}`
	if (sameDay(at, now - DAY_MS)) return `Yesterday, ${time}`

	return new Date(at).toLocaleString()
}

/** Builds the review pane; the notes field is omitted on surfaces without an input, where the ticks still work, and when nothing is pending, since only Apply and Decline read it. */
export function paneView(
	ui: PaneElements,
	model: PaneModel,
	handlers: PaneHandlers
) {
	const { Box, Text, Button, Input } = ui
	const count = model.ticked.length

	return (
		<Box flexDirection="column" gap={1}>
			{model.report.length > 0 &&
				reportBox(ui, model.report, handlers.dismissReport)}
			{model.waiting.length === 0 && model.busy === null && (
				<Box flexDirection="column">
					<Text dimColor>Nothing pending review.</Text>
					{model.lastRun !== null && (
						<Text
							dimColor
						>{`Last review: ${lastReview(model.lastRun, Date.now())}`}</Text>
					)}
					<Text dimColor>Press Run now or use the /feedback-loop skill</Text>
				</Box>
			)}
			{model.waiting.map((item) =>
				suggestionRow(
					ui,
					item,
					model.ticked.includes(item.key),
					handlers.toggle(item.key)
				)
			)}
			{Input && model.waiting.length > 0 && (
				<Input
					key="correction"
					label="Notes"
					placeholder="Context or changes for the ticked suggestions"
					rows={6}
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
