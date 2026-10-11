import type { Attachment } from '../types'

export const THUMB_COLUMNS = 12
export const THUMB_ROWS = 6

/** Formats a byte count the way Finder does, in decimal units. */
const formatBytes = (bytes: number) => {
	if (bytes < 1000) return `${bytes} B`
	if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`
	return `${(bytes / 1_000_000).toFixed(1)} MB`
}

/** Pads an hour or minute to two digits. */
const pad = (value: number) => String(value).padStart(2, '0')

/** Formats when an attachment was added as a local 24-hour time. */
const formatTime = (at: number) => {
	const date = new Date(at)

	return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Joins the known facts into one line, skipping any not yet measured. */
export const factsLine = (item: Attachment) =>
	[
		formatTime(item.addedAt),
		item.width && item.height ? `${item.width}×${item.height}` : undefined,
		item.bytes === undefined ? undefined : formatBytes(item.bytes),
	]
		.filter(Boolean)
		.join(' · ')

/** Sizes a thumbnail's cell box to the picture's aspect, taking a cell as twice as tall as wide. */
export const thumbCells = (width = 1, height = 1) => {
	const aspect = width / height
	if (aspect >= 1)
		return {
			columns: THUMB_COLUMNS,
			rows: Math.max(1, Math.round(THUMB_ROWS / aspect)),
		}
	return {
		columns: Math.max(2, 2 * Math.round((THUMB_COLUMNS * aspect) / 2)),
		rows: THUMB_ROWS,
	}
}

/** The text the ref button puts in the prompt: the ref Claude saw, and the saved path it can still Read after compaction. */
export const promptRef = (item: Attachment) => `${item.ref} (${item.path}) `
