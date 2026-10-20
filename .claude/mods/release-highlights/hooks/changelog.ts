import type { Category, Highlight } from '../types'

/** Highest priority first: what the band leads with. */
export const CATEGORY_ORDER: Category[] = [
	'feature',
	'change',
	'breaking',
	'other',
]

const MAX_VERSIONS = 15

/** Compares two versions by their numeric core, so `2.1.304-dev` equals `2.1.304`. */
export const compareVersions = (a: string, b: string) => {
	const [left, right] = [a, b].map((version) =>
		(version.match(/\d+/g) ?? []).slice(0, 3).map(Number)
	)

	for (let i = 0; i < 3; i++) {
		const diff = (left?.[i] ?? 0) - (right?.[i] ?? 0)
		if (diff !== 0) return diff
	}

	return 0
}

/** The changelog's `## <version>` sections after `from` up to `to`, newest first and capped, so a long absence cannot flood the model. */
export const sectionsBetween = (changelog: string, from: string, to: string) =>
	changelog
		.split(/^## /m)
		.slice(1)
		.filter((section) => {
			const version = section.split('\n', 1)[0]?.trim() ?? ''

			return (
				compareVersions(version, from) > 0 && compareVersions(version, to) <= 0
			)
		})
		.slice(0, MAX_VERSIONS)
		.map((section) => `## ${section.trim()}`)

const isHighlight = (value: unknown): value is Highlight =>
	typeof value === 'object' &&
	value !== null &&
	'category' in value &&
	'text' in value &&
	CATEGORY_ORDER.some((category) => category === value.category) &&
	typeof value.text === 'string'

/** Asks for JSON in the shape `parseHighlights` reads. */
export const summarisePrompt = (sections: string[]) =>
	`Pick the most useful highlights for a Claude Code user from these changelog entries.

Reply with ONLY a JSON array of at most 8 objects: {"category": "feature" | "change" | "breaking" | "other", "text": "<one line, under 100 chars>"}.
- feature: new capabilities. change: user-facing behaviour changes. breaking: breaking changes. other: anything else notable.
- Skip minor bug fixes unless nothing else is notable. Merge related entries.

${sections.join('\n\n')}`

/** Reads the model's reply, ignoring prose around the JSON array and entries of the wrong shape, and orders by category priority whatever order the model chose. */
export const parseHighlights = (reply: string): Highlight[] => {
	const json = reply.match(/\[[\s\S]*\]/)?.[0]
	if (!json) return []

	const parsed: unknown = JSON.parse(json)
	if (!Array.isArray(parsed)) return []

	return parsed
		.filter(isHighlight)
		.toSorted(
			(a, b) =>
				CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
		)
}
