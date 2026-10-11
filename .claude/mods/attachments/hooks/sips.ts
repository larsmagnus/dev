const THUMB_PIXELS = 256

/** Writes a PNG thumbnail, the only format the terminal Image reads from a file. sips also renders a PDF's first page, so documents get one too. */
export const thumbArgv = (source: string, thumb: string) => [
	'sips',
	'-s',
	'format',
	'png',
	'-Z',
	String(THUMB_PIXELS),
	source,
	'--out',
	thumb,
]

/** Asks sips for pixel size alone. The save step runs it for images only, so documents keep no dimensions. */
export const sizeArgv = (source: string) => [
	'sips',
	'-g',
	'pixelWidth',
	'-g',
	'pixelHeight',
	source,
]

/** Reads width and height from `sips -g` output, or nothing unless both are positive. */
export const parseSize = (stdout: string) => {
	const width = Number(/pixelWidth: (\d+)/.exec(stdout)?.[1])
	const height = Number(/pixelHeight: (\d+)/.exec(stdout)?.[1])

	return width > 0 && height > 0 ? { width, height } : undefined
}
