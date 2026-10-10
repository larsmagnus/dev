import type { ClientModule } from 'claude-code'

export type DividerProps = { label: string; columns: number; bodyRows: number }
type Local = {
	isDragging: boolean
	isHovered: boolean
	ref: { unpoint?: () => void; postedAt: number }
}

// A move is measured from where the divider is drawn; spacing posts out lets each redraw land before the next.
const MOVE_INTERVAL_MS = 60

/** The rule between the host's tree and the agents, lit in the dock resizer's colour; dragging it posts each row it moves, and the end of the drag. */
const Divider: ClientModule<DividerProps, Local> = (props, surface) => {
	const { Text } = surface.elements
	const state = surface.state ?? {
		isDragging: false,
		isHovered: false,
		ref: { postedAt: 0 },
	}
	if (surface.state === undefined) surface.setState(state)

	state.ref.unpoint?.()
	state.ref.unpoint = surface.onPointer((e) => {
		const current = surface.state ?? state
		if (e.type === 'down' && (e.button ?? 'left') === 'left')
			return surface.setState({ ...current, isDragging: true })
		if (e.type === 'up' && current.isDragging) {
			surface.setState({ ...current, isDragging: false })
			return surface.post({ done: true })
		}
		if (e.type === 'move' && current.isDragging) {
			if (e.y === 0 || Date.now() - state.ref.postedAt < MOVE_INTERVAL_MS)
				return
			state.ref.postedAt = Date.now()
			return surface.post({ moveBy: e.y, bodyRows: props.bodyRows })
		}

		const isHovered = e.type !== 'leave' && e.y === 0
		if (isHovered !== current.isHovered)
			surface.setState({ ...current, isHovered })
	})

	const isLit = state.isDragging || state.isHovered
	return (
		<Text dimColor={!isLit} color={isLit ? 'suggestion' : undefined}>
			{`── ${props.label} ${isLit ? '⇕ ' : ''}`.padEnd(
				Math.max(10, props.columns),
				'─'
			)}
		</Text>
	)
}

export default Divider
