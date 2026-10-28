type Language = 'mermaid' | 'drawio'

export type Diagram = {
	kind: 'diagram'
	language: Language
	source: string
	/** The block as written, so it can be shown unchanged. */
	fence: string
	hash: string
}
type Prose = { kind: 'text'; text: string }
export type Segment = Prose | Diagram

const FENCE = /^```(mermaid|drawio)[ \t]*\n([\s\S]*?)^```[ \t]*$/gm

/** A short stable id for a diagram's content, since the module has no crypto to hash with. FNV-1a. */
function hashOf(text: string) {
	let hash = 0x811c9dc5
	for (const char of text) {
		hash = Math.imul(hash ^ char.codePointAt(0)!, 0x01000193)
	}
	return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Splits a reply into prose and its closed mermaid/drawio fences. A fence still streaming has no closing line yet, so it stays prose. */
export function splitFences(text: string): Segment[] {
	const segments: Segment[] = []
	let cursor = 0

	for (const match of text.matchAll(FENCE)) {
		const [fence, tag, body = ''] = match
		const source = body.replace(/\n$/, '')
		const language = tag === 'drawio' ? 'drawio' : 'mermaid'
		if (match.index > cursor)
			segments.push({ kind: 'text', text: text.slice(cursor, match.index) })
		segments.push({
			kind: 'diagram',
			language,
			source,
			fence,
			hash: hashOf(`${language}\n${source}`),
		})
		cursor = match.index + fence.length
	}
	if (cursor < text.length)
		segments.push({ kind: 'text', text: text.slice(cursor) })

	return segments
}

/** Narrows a segment to a drawable diagram, leaving prose alone. */
export const isDiagram = (segment: Segment): segment is Diagram =>
	segment.kind === 'diagram'
