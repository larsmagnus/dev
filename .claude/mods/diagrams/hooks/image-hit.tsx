import type { ClientModule } from 'claude-code'

export type ImageHitProps = { columns: number; rows: number }

/** A pointer region over a diagram picture, since an Image takes no press. It draws nothing, which would cover the picture. */
const ImageHit: ClientModule<ImageHitProps> = (props, surface) => {
	const { Box } = surface.elements
	surface.onPointer((e) => {
		if (e.type === 'down' && (e.button ?? 'left') === 'left')
			surface.post({ open: true })
	})

	return <Box width={props.columns} height={props.rows} />
}

export default ImageHit
