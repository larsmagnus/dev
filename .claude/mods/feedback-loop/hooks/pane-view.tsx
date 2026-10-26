import type { Elements } from 'claude-code'

import type { Suggestion } from '../types'

import { suggestionRow } from './suggestion-row'

type PaneElements = Pick<
	Elements['terminal'],
	'Box' | 'Text' | 'Button' | 'Link'
> &
	Partial<Pick<Elements['terminal'], 'Input'>>

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

const URL_PATTERN = /(https?:\/\/[^\s)]*[^\s).,;:!?])/

/** Splits a line into plain text and clickable links; the capture group puts every URL at an odd index. */
const withLinks = (Link: PaneElements['Link'], line: string) =>
	line
		.split(URL_PATTERN)
		.map((part, i) =>
			i % 2 === 1 ? <Link key={`link:${i}`} href={part} /> : part
		)

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

const COUNTS = /^(\d+ applied), (\d+ not applied), (\d+ declined)$/

/** Colours the apply summary's three counts; any other line stays plain. */
function reportLine(
	ui: PaneElements,
	line: string,
	isSummary: boolean,
	key: string
) {
	const { Box, Text, Link } = ui
	const match = isSummary ? COUNTS.exec(line) : null
	if (!match)
		return (
			<Text key={key} bold={isSummary}>
				{withLinks(Link, line)}
			</Text>
		)

	const [, applied, notApplied, declined] = match
	return (
		<Box key={key}>
			<Text bold color="success">
				{applied}
			</Text>
			<Text bold>, </Text>
			<Text bold color="warning">
				{notApplied}
			</Text>
			<Text bold>, </Text>
			<Text bold color="error">
				{declined}
			</Text>
		</Box>
	)
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
			{model.report.length > 0 && (
				<Box flexDirection="column" borderStyle="round" paddingX={1}>
					<Box justifyContent="space-between">
						<Box flexDirection="column">
							{model.report.map((line, i) =>
								reportLine(ui, line, i === 0, `report:${i}`)
							)}
						</Box>
						<Button
							key="dismiss-report-x"
							label="x"
							onPress={handlers.dismissReport}
						/>
					</Box>
					<Button
						key="dismiss-report"
						label="Dismiss"
						onPress={handlers.dismissReport}
					/>
				</Box>
			)}
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
