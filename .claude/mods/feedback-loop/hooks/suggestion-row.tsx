import type { Elements } from 'claude-code'

import type { Suggestion } from '../types'

export type RowElements = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button'>

/** Builds one suggestion's row; the tick is a toggle button because the surface has no checkbox. */
export const suggestionRow = (
	ui: RowElements,
	item: Suggestion,
	isSelected: boolean,
	toggle: () => void
) => {
	const { Box, Text, Button } = ui

	return (
		<Box key={item.key} flexDirection="column" marginBottom={1}>
			<Button key={`toggle:${item.key}`} onPress={toggle}>
				<Text color={isSelected ? 'success' : undefined}>
					{isSelected ? '[x]' : '[ ]'}
				</Text>{' '}
				<Text bold>{item.finding}</Text>{' '}
				<Text dimColor>
					[{item.type}] seen {item.seenCount}×
				</Text>
			</Button>
			<Text dimColor>→ {item.action}</Text>
			{item.note && <Text color="warning">↳ {item.note}</Text>}
			{item.evidence.slice(-2).map((line, i) => (
				<Text key={`evidence:${i}`} dimColor>
					· {line}
				</Text>
			))}
		</Box>
	)
}
