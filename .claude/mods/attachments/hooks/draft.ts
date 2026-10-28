const DRAFT_IMAGE_REF = /\[Image #(\d+)\]/g

/** The engine caches pastes by number, and the draft text is the only record of which ones it still holds. */
export const draftImageNumbers = (text: string) => [
	...new Set(
		[...text.matchAll(DRAFT_IMAGE_REF)].map((match) => Number(match[1]))
	),
]

/** Cached pastes are named `<number>.<ext>`, so the extension is unknown and the match is by prefix. */
export const cachedPasteName = (names: readonly string[], number: number) =>
	names.find((name) => name.startsWith(`${number}.`))
