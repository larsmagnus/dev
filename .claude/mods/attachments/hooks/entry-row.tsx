import type { Elements } from 'claude-code'

import type { Attachment } from '../types'

import { factsLine } from './format'
import { thumb } from './thumb'

export type RowElements = Pick<
	Elements['desktop'],
	'Box' | 'Text' | 'Button' | 'Link'
> &
	Partial<Pick<Elements['terminal'], 'Image' | 'Client'>>

/** Builds a `file://` link that survives spaces and `#` in a path. */
const fileUrl = (path: string) =>
	`file://${path.split('/').map(encodeURIComponent).join('/')}`

const REF_COLORS = {
	image: 'ide',
	document: 'merged',
	file: 'warning',
} as const

/** Builds one archived attachment's row. The ref button is how a person puts it back into the prompt. */
export const entryRow = (
	ui: RowElements,
	item: Attachment,
	insertRef: () => void
) => {
	const { Box, Text, Button, Link } = ui
	const name = item.filename ?? item.path.split('/').at(-1)

	return (
		<Box key={item.path} flexDirection="row" gap={3} marginBottom={1}>
			{thumb(ui, item)}
			<Box flexDirection="column" flexShrink={1} marginTop={1}>
				<Button
					key={`ref:${item.path}`}
					label={item.ref}
					plain
					onPress={insertRef}
				>
					<Text color={REF_COLORS[item.kind]}>{item.ref}</Text>
				</Button>
				<Link href={fileUrl(item.path)}>{name}</Link>
				<Text dimColor wrap="truncate-start">
					<Link href={fileUrl(item.path)}>{item.path}</Link>
				</Text>
				{item.context && (
					<Text dimColor italic>
						{item.context}
					</Text>
				)}
				<Text dimColor>{factsLine(item)}</Text>
			</Box>
		</Box>
	)
}
