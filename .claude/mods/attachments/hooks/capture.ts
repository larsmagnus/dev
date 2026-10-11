import type { AttachmentKind } from '../types'

import { contextAround } from './context'
import { newestRefs, stemOf } from './refs'

type Block = { type: string; [field: string]: unknown }

export type Pending = {
	ref: string
	kind: AttachmentKind
	mediaType: string
	data: string
	stem: string
	extension: string
	context?: string
}

const KINDS = ['image', 'document'] as const satisfies readonly AttachmentKind[]

const EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/heic': 'heic',
	'application/pdf': 'pdf',
}

const INLINE_REF = /\[(Image|Document) #\d+\](?! \(\/)/g
const SOURCE = /\[Image: source: (.+?)\]/g

/** Narrows a content block to an inline base64 image or document, the only kinds that carry bytes to archive. */
const asMedia = (block: Block) => {
	const kind = KINDS.find((one) => one === block.type)
	const source = block.source
	if (!kind || typeof source !== 'object' || source === null) return undefined
	if (!('type' in source) || source.type !== 'base64') return undefined
	if (!('data' in source) || typeof source.data !== 'string') return undefined
	const mediaType =
		'media_type' in source && typeof source.media_type === 'string'
			? source.media_type
			: 'application/octet-stream'

	return { kind, mediaType, data: source.data }
}

/** Joins a row's text blocks, where the engine writes its `[Image #n]` refs. */
export const textOf = (content: readonly Block[]) =>
	content
		.flatMap((block) =>
			block.type === 'text' && typeof block.text === 'string'
				? [block.text]
				: []
		)
		.join('\n')

/** Pairs each media block with the engine's ref of its kind, in order, and numbers any block without one itself. */
export const pendingAttachments = (
	content: readonly Block[],
	archived: number
): Pending[] => {
	const text = textOf(content)
	const refs = [...text.matchAll(INLINE_REF)]
	const media = content.flatMap((block) => asMedia(block) ?? [])

	return media.map((one, index) => {
		const count = media.filter((other) => other.kind === one.kind).length
		const nth = media
			.slice(0, index)
			.filter((earlier) => earlier.kind === one.kind).length
		const ref =
			newestRefs(refs, one.kind, count)[nth] ??
			`[Attachment #${archived + index + 1}]`

		return {
			...one,
			ref,
			stem: stemOf(ref),
			extension: EXTENSIONS[one.mediaType] ?? 'bin',
			context: contextAround(text, ref),
		}
	})
}

/** Reads the original paths the engine notes for dropped images in a meta row, in order. */
export const sourcePaths = (text: string) =>
	[...text.matchAll(SOURCE)].flatMap((match) => match[1] ?? [])

/** Names the newest unnamed images, since a dropped image's source path arrives in a meta row after its prompt row is already archived. */
export const withSources = <
	T extends { kind: AttachmentKind; filename?: string },
>(
	items: readonly T[],
	paths: readonly string[]
): T[] => {
	const unnamed = items.flatMap((item, index) =>
		item.kind === 'image' && !item.filename ? [index] : []
	)
	const targets = unnamed.slice(-paths.length)
	const named = new Map(
		targets.map((index, at) => [index, paths.slice(-targets.length)[at]])
	)

	return items.map((item, index) => {
		const path = named.get(index)
		return path ? { ...item, filename: path.split('/').at(-1) } : item
	})
}

/** Guesses a file's media type from its extension, for the few kinds the archive names. */
export const mediaTypeOf = (path: string) =>
	Object.entries(EXTENSIONS).find(([, extension]) =>
		path.toLowerCase().endsWith(`.${extension}`)
	)?.[0] ?? 'application/octet-stream'
