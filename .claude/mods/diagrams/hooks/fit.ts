import type { Rendered } from '../types'

const CELL_WIDTH_PX = 9
const CELL_HEIGHT_PX = 18
const MAX_COLUMNS = 100
const IMAGE_LIMIT_CELLS = 255

/** Sizes a picture in terminal cells, shrunk to fit the column cap and the image limit while keeping its aspect. */
export function fitCells({
	width,
	height,
}: Pick<Rendered, 'width' | 'height'>) {
	const columns = width / CELL_WIDTH_PX
	const rows = height / CELL_HEIGHT_PX
	const scale = Math.min(1, MAX_COLUMNS / columns, IMAGE_LIMIT_CELLS / rows)

	return {
		columns: Math.max(1, Math.round(columns * scale)),
		rows: Math.max(1, Math.round(rows * scale)),
	}
}
