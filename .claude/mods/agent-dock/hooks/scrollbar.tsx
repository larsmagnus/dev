import type { DockElements } from './elements'

export const SCROLLBAR_COLUMNS = 1

const THUMB = '┃'
const TRACK = '│'

export type ScrollbarProps = {
	ui: DockElements
	total: number
	visible: number
	start: number
}

/** A one-column scrollbar `visible` rows tall: the thumb marks which `visible` of `total` rows are shown from `start`; the column stays empty when all rows fit, so the content never changes width. */
export const drawScrollbar = ({
	ui,
	total,
	visible,
	start,
}: ScrollbarProps) => {
	const { Box, Text } = ui
	if (total <= visible || visible < 1)
		return <Box flexShrink={0} width={SCROLLBAR_COLUMNS} />

	const size = Math.max(1, Math.round((visible / total) * visible))
	const maxStart = total - visible
	const thumbAt = Math.round(
		(Math.min(Math.max(0, start), maxStart) / maxStart) * (visible - size)
	)

	return (
		<Box flexDirection="column" flexShrink={0} width={SCROLLBAR_COLUMNS}>
			{Array.from({ length: visible }, (_, at) => {
				const isThumb = at >= thumbAt && at < thumbAt + size

				return <Text dimColor={!isThumb}>{isThumb ? THUMB : TRACK}</Text>
			})}
		</Box>
	)
}
