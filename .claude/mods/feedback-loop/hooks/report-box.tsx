import type { Elements } from 'claude-code'

export type PaneElements = Pick<
	Elements['terminal'],
	'Box' | 'Text' | 'Button' | 'Link'
> &
	Partial<Pick<Elements['terminal'], 'Input'>>

const URL_PATTERN = /(https?:\/\/[^\s)]*[^\s).,;:!?])/

/** Splits a line into plain text and clickable links; the capture group puts every URL at an odd index. */
const withLinks = (Link: PaneElements['Link'], line: string) =>
	line
		.split(URL_PATTERN)
		.map((part, i) =>
			i % 2 === 1 ? <Link key={`link:${i}`} href={part} /> : part
		)

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

/** The apply result in a dismissable box; the x and the bottom button do the same, so it closes from wherever the eye is. */
export const reportBox = (
	ui: PaneElements,
	report: string[],
	dismiss: () => void
) => {
	const { Box, Button } = ui

	return (
		<Box flexDirection="column" borderStyle="round" paddingX={1}>
			<Box justifyContent="space-between">
				<Box flexDirection="column">
					{report.map((line, i) =>
						reportLine(ui, line, i === 0, `report:${i}`)
					)}
				</Box>
				<Button key="dismiss-report-x" label="x" onPress={dismiss} />
			</Box>
			<Button key="dismiss-report" label="Dismiss" onPress={dismiss} />
		</Box>
	)
}
