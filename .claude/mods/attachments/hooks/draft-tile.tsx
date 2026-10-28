import type { Attachment } from '../types'

import type { RowElements } from './entry-row'
import { thumb } from './thumb'

/** Draws a draft entry's tile with its number beneath, which tells a ref in the prompt from its neighbours. */
export const draftTile = (ui: RowElements, item: Attachment) => (
	<ui.Box key={item.path} flexDirection="column" alignItems="center">
		{thumb(ui, item)}
		<ui.Text dimColor>{/#\d+/.exec(item.ref)?.[0]}</ui.Text>
	</ui.Box>
)
