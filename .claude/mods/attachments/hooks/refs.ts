import type { AttachmentKind } from '../types'

/** Picks the refs a prompt's own media carry. The engine numbers attachments upward, so a mention of an earlier one always has a lower number. */
export const newestRefs = (
	refs: readonly RegExpMatchArray[],
	kind: AttachmentKind,
	count: number
) =>
	[
		...new Set(
			refs.flatMap((match) =>
				match[1]?.toLowerCase() === kind ? [match[0]] : []
			)
		),
	]
		.toSorted((a, b) => refNumber(a) - refNumber(b))
		.slice(-count)

/** Reads the number out of a ref like `[Image #12]`. */
const refNumber = (ref: string) => Number(/#(\d+)/.exec(ref)?.[1])

/** Turns `[Image #2]` into `image-2`, a file stem that reads like the ref. */
export const stemOf = (ref: string) =>
	ref.slice(1, -1).replace(' #', '-').toLowerCase()
