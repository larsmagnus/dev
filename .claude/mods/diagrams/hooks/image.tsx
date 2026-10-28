import type { Elements, UiPressArgument } from 'claude-code'

import type { Rendered } from '../types'

import { pictureFrame } from './picture'
import type { Diagram } from './segments'

export type DiagramElements = Pick<
	Elements['terminal'],
	'Box' | 'Button' | 'Markdown' | 'Image' | 'Client'
>

export type DiagramActions = {
	onToggle: () => void
	onCopy: (press: UiPressArgument) => void
	onDownload: () => void
}

/** The picture of a drawn diagram, or its source, under a row of buttons: swap, copy the source, download the picture. Pressing the picture opens it. */
export function diagramRow(
	{ Box, Button, Markdown, Image, Client }: DiagramElements,
	diagram: Diagram,
	index: number,
	rendered: Rendered,
	isSourceShown: boolean,
	{ onToggle, onCopy, onDownload }: DiagramActions
) {
	return (
		<Box key={`diagram:${index}`} flexDirection="column">
			<Box flexDirection="row" gap={1}>
				<Button
					key={`toggle:${index}`}
					label={isSourceShown ? '[diagram]' : '[source]'}
					onPress={onToggle}
				/>
				<Button key={`copy:${index}`} label="[copy]" onPress={onCopy} />
				<Button
					key={`download:${index}`}
					label="[download]"
					onPress={onDownload}
				/>
			</Box>
			{isSourceShown ? (
				<Markdown text={diagram.fence} />
			) : (
				pictureFrame({ Box, Image, Client }, diagram, index, rendered)
			)}
		</Box>
	)
}
