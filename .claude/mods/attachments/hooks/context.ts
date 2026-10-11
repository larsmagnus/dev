const CONTEXT_RADIUS = 60

/** Quotes the prompt around a ref or path, so an entry recalls why it was attached; nothing when the prompt was the ref alone. */
export const contextAround = (text: string, needle: string) => {
	const flat = text.replaceAll('\\ ', ' ').replaceAll(/\s+/g, ' ').trim()
	const at = flat.indexOf(needle)
	if (at === -1 || flat === needle) return undefined

	const start = Math.max(0, at - CONTEXT_RADIUS)
	const end = Math.min(flat.length, at + needle.length + CONTEXT_RADIUS)
	const isHeadCut = start > 0 && flat[start - 1] !== ' '
	const isTailCut = end < flat.length && flat[end] !== ' '
	const words = flat
		.slice(start, end)
		.replace(isHeadCut ? /^\S*/ : /^/, '')
		.replace(isTailCut ? /\S*$/ : /$/, '')
		.trim()

	return `${start > 0 ? '…' : ''}${words}${end < flat.length ? '…' : ''}`
}
