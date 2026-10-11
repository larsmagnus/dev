import type { Attachment } from '../types'

/** Narrows one entry of a stored index, written by an earlier load of the mod or edited by hand. */
const isAttachment = (value: unknown): value is Attachment => {
	if (typeof value !== 'object' || value === null) return false
	const entry: Partial<Record<keyof Attachment, unknown>> = value

	return (
		typeof entry.ref === 'string' &&
		(entry.kind === 'image' ||
			entry.kind === 'document' ||
			entry.kind === 'file') &&
		typeof entry.mediaType === 'string' &&
		typeof entry.addedAt === 'number' &&
		typeof entry.path === 'string'
	)
}

/** Reads a session's `index.json`, keeping the entries that still hold their shape; anything unreadable is an empty archive. */
export const parseIndex = (text: string): Attachment[] => {
	try {
		const parsed: unknown = JSON.parse(text)
		return Array.isArray(parsed) ? parsed.filter(isAttachment) : []
	} catch {
		return []
	}
}

/** Adds the entries whose paths the archive does not hold yet. A path is unique per attachment, so a row seen twice is archived once and two attachments sharing a ref both stay. */
export const withNew = (
	items: readonly Attachment[],
	entries: readonly Attachment[]
) => {
	const known = new Set(items.map((item) => item.path))
	return [...items, ...entries.filter((entry) => !known.has(entry.path))]
}
