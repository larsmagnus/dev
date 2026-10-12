const BAND_SPEED = 1.6
const BAND_MARGIN = 4
const LIT_FACTOR = 1.6
const DIM_FACTORS = [0.55, 0.8]

/** Scales a `#rrggbb` color toward black (below 1) or white (above 1); anything else comes back as it was. */
const tone = (hex: string, factor: number) => {
	if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
	const channel = (at: number) => {
		const value = parseInt(hex.slice(at, at + 2), 16)
		const toned =
			factor <= 1 ? value * factor : value + (255 - value) * (factor - 1)

		return Math.round(toned).toString(16).padStart(2, '0')
	}

	return `#${channel(1)}${channel(3)}${channel(5)}`
}

/** The color of character `at` of `length` as a bright band sweeps across them at `phase`, dim at the edges and lit in the band's core. */
export const shimmerColor = (
	at: number,
	phase: number,
	length: number,
	color: string
) => {
	const band = ((phase * BAND_SPEED) % (length + 2 * BAND_MARGIN)) - BAND_MARGIN
	const distance = Math.abs(at - band)
	const [dimmest = 0.55, dim = 0.8] = DIM_FACTORS

	if (distance < 0.8) return tone(color, LIT_FACTOR)
	if (distance < 1.8) return color
	if (distance < 2.8) return tone(color, dim)
	return tone(color, dimmest)
}
