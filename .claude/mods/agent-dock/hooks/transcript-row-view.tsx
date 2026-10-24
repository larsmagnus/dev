import type { DockElements } from './elements'
import { linkified } from './linkify'
import type { RowPart } from './transcript-parts'

export type ShownRow = { gutter: string; parts: RowPart[] }

/** Draws one transcript row: its number, then its pieces in their own weight and color. */
export const drawTranscriptRow = (ui: DockElements, shown: ShownRow) => {
	const { Text } = ui

	return (
		<Text wrap="truncate-end">
			<Text dimColor>{shown.gutter}</Text>
			{shown.parts.map((part) => (
				<Text
					key={part.text}
					bold={part.isBold}
					dimColor={part.isDim}
					color={part.color}
				>
					{linkified(ui, part.text)}
				</Text>
			))}
		</Text>
	)
}
