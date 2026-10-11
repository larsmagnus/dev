import type { ClientModule } from 'claude-code'

export type ThumbHitProps = { columns: number; rows: number; label: string }

/** A pointer region over a thumbnail, since an Image takes no press. Over a picture it draws nothing, which would cover it; with no picture it draws the placeholder label. */
const ThumbHit: ClientModule<ThumbHitProps> = (props, surface) => {
	const { Box, Text } = surface.elements
	surface.onPointer((e) => {
		if (e.type === 'down' && (e.button ?? 'left') === 'left')
			surface.post({ open: true })
	})

	return (
		<Box
			width={props.columns}
			height={props.rows}
			justifyContent="center"
			alignItems="center"
		>
			{props.label !== '' && <Text dimColor>{props.label}</Text>}
		</Box>
	)
}

export default ThumbHit
