import type { Attachment } from '../types'

import type { RowElements } from './entry-row'
import { THUMB_COLUMNS, THUMB_ROWS, thumbCells } from './format'

const A4_PAGE_ASPECT = 1.41

const FRAME = {
	width: THUMB_COLUMNS + 2,
	height: THUMB_ROWS + 2,
	flexShrink: 0,
	flexDirection: 'column',
	alignItems: 'center',
	borderStyle: 'round',
	borderDimColor: true,
} as const

/** Names what a frame holds when there is no picture to show, by extension where the file has one: `.txt file`. */
export const placeholderLabel = (item: Attachment) => {
	const extension = /\.(\w+)$/.exec(item.filename ?? item.path)?.[1]
	return extension ? `.${extension.toLowerCase()} ${item.kind}` : item.kind
}

/** Draws a fixed-size frame, so every row's text starts at the same column, that lights on hover and opens the file on click. It holds the thumbnail top-aligned, or a placeholder label when there is none. */
export const thumb = (ui: RowElements, item: Attachment) => {
	const { Box, Text, Image, Client } = ui
	if (!Client)
		return (
			<Box {...FRAME}>
				<Text dimColor>{placeholderLabel(item)}</Text>
			</Box>
		)

	const picture =
		Image && item.thumbPath
			? thumbCells(item.width ?? 1, item.height ?? A4_PAGE_ASPECT)
			: undefined
	const { columns, rows } = picture ?? {
		columns: THUMB_COLUMNS,
		rows: THUMB_ROWS,
	}
	return (
		<Box
			key={`frame:${item.path}`}
			{...FRAME}
			hover={{ borderColor: 'suggestion', borderDimColor: false }}
		>
			<Box position="relative" width={columns} height={rows}>
				{picture && Image && item.thumbPath && (
					<Image
						source={{ file: item.thumbPath, format: 'png' }}
						columns={columns}
						rows={rows}
						alt={item.ref}
					/>
				)}
				<Box position="absolute" top={0} left={0}>
					<Client
						key={`thumb:${item.path}`}
						module="./thumb-hit.tsx"
						props={{
							columns,
							rows,
							label: picture ? '' : placeholderLabel(item),
						}}
						width={columns}
						height={rows}
					/>
				</Box>
			</Box>
		</Box>
	)
}
