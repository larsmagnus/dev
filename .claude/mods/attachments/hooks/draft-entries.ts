import type { Attachment } from '../types'

import { mediaTypeOf } from './capture'
import { cachedPasteName } from './draft'

export type DraftEntry = Omit<Attachment, 'addedAt'>

/** Where each project's cache of this session's pasted images would be. */
export const pasteDirCandidates = (
	root: string,
	projects: readonly string[],
	sessionId: string
) => projects.map((project) => `${root}/${project}/${sessionId}/images`)

/** Entries for the numbered pastes whose cached files exist yet. */
export const pastedEntries = (
	dir: string,
	names: readonly string[],
	numbers: readonly number[]
): DraftEntry[] =>
	numbers.flatMap((number) => {
		const name = cachedPasteName(names, number)
		if (!name) return []
		const path = `${dir}/${name}`

		return [
			{
				ref: `[Image #${number}]`,
				kind: 'image',
				mediaType: mediaTypeOf(path),
				path,
			},
		]
	})

/** Entries for existing files, numbered like the archive numbers them. */
export const fileEntries = (paths: readonly string[]): DraftEntry[] =>
	paths.map((path, index) => ({
		ref: `[File #${index + 1}]`,
		kind: 'file',
		mediaType: mediaTypeOf(path),
		filename: path.split('/').at(-1),
		path,
	}))
