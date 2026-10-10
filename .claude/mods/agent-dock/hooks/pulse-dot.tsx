import type { ClientModule } from 'claude-code'

export type PulseDotProps = { color: string; isActive: boolean }
type Local = { phase: number; ref: { stop?: () => void } }

const FRAME_MS = 120
const SHADES = [0.35, 0.5, 0.7, 0.85, 1, 0.85, 0.7, 0.5]

/** Scales a `#rrggbb` color toward black, so one hue yields every shade of the pulse. */
const shade = (hex: string, factor: number) => {
	const channel = (at: number) =>
		Math.round(parseInt(hex.slice(at, at + 2), 16) * factor)
			.toString(16)
			.padStart(2, '0')

	return /^#[0-9a-f]{6}$/i.test(hex)
		? `#${channel(1)}${channel(3)}${channel(5)}`
		: hex
}

/** Pulses the agent's dot on the drawing thread while it works, so the pane itself never redraws per frame. */
const PulseDot: ClientModule<PulseDotProps, Local> = (props, surface) => {
	const { Text } = surface.elements
	const state = surface.state ?? { phase: 0, ref: {} }
	if (surface.state === undefined) surface.setState(state)

	if (props.isActive && !state.ref.stop) {
		state.ref.stop = surface.every(FRAME_MS, () => {
			const current = surface.state
			if (current) surface.setState({ ...current, phase: current.phase + 1 })
		})
	} else if (!props.isActive && state.ref.stop) {
		state.ref.stop()
		state.ref.stop = undefined
	}

	const factor = props.isActive ? (SHADES[state.phase % SHADES.length] ?? 1) : 1

	return <Text color={shade(props.color, factor)}>●</Text>
}

export default PulseDot
