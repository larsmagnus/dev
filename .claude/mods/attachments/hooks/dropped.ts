const ABSOLUTE_PATH =
	/"(\/[^"]+)"|'(\/[^']+)'|(?<=^|[\s(`])\/(?:\\ |[^\s'"`])+/g
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/

/** Reads the absolute paths a prompt names, without the sentence punctuation after them. A quoted path keeps its spaces; the terminal escapes them in a dropped one, so those are unescaped here. */
export const droppedPaths = (text: string) => [
	...new Set(
		[...text.matchAll(ABSOLUTE_PATH)].map(
			(match) =>
				match[1] ??
				match[2] ??
				match[0].replaceAll('\\ ', ' ').replace(TRAILING_PUNCTUATION, '')
		)
	),
]
