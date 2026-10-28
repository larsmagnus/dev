import type { EngineInterface } from 'claude-code'

import type { Attachment } from '../types'

import { fileEntries, pasteDirCandidates, pastedEntries } from './draft-entries'
import { droppedPaths } from './dropped'
import { measure, tryRun } from './host'

/** Finds where the engine cached the session's pasted images, once the folder exists. The project folder is named for a working directory that may since have moved, so it is found by session id. */
async function pasteDir($: EngineInterface) {
	const base = (await $.env.get('CLAUDE_CODE_TMPDIR')) ?? '/tmp'
	const uid = (await tryRun($, ['id', '-u'])).stdout.trim()
	const root = `${base.replace(/\/+$/, '')}/claude-${uid}`
	const projects = await $.fs.list(root).catch(() => [])
	const dirs = pasteDirCandidates(
		root,
		projects.map((project) => project.name),
		await $.session.id()
	)
	const found = await Promise.all(dirs.map((dir) => $.fs.exists(dir)))

	return dirs.find((_, index) => found[index])
}

let pasteFolder: string | undefined

const draftFacts = new Map<string, Promise<Partial<Attachment>>>()

/** Forgets what belongs to the session that ended: its paste folder and its draft thumbnails. */
export function forgetSession() {
	pasteFolder = undefined
	draftFacts.clear()
}

/** The paste folder, looked for again until it appears and then kept for the session. */
async function knownPasteDir($: EngineInterface) {
	pasteFolder ??= await pasteDir($)
	return pasteFolder
}

/** Lists the pasted images a draft names, as far as their cached files exist yet. */
export async function draftPastes($: EngineInterface, numbers: number[]) {
	const dir = numbers.length > 0 ? await knownPasteDir($) : undefined
	if (!dir) return []
	const listing = await $.fs.list(dir).catch(() => [])

	return pastedEntries(
		dir,
		listing.map((entry) => entry.name),
		numbers
	)
}

/** Lists the existing files a draft names by path. */
export async function draftFiles($: EngineInterface, text: string) {
	const stats = await Promise.all(
		droppedPaths(text).map((path) =>
			$.fs.stat(path).then(
				(stat) => (stat.kind === 'file' ? [path] : []),
				() => []
			)
		)
	)

	return fileEntries(stats.flat())
}

/** Thumbnails a draft entry once, however many polls see it. */
export function draftFactsOf(
	$: EngineInterface,
	one: Pick<Attachment, 'path' | 'mediaType'>,
	archiveDir: string
) {
	const known = draftFacts.get(one.path)
	if (known) return known
	const thumbPath = `${archiveDir}/draft/${draftFacts.size}.thumb.png`
	const facts = tryRun($, ['mkdir', '-p', `${archiveDir}/draft`]).then(() =>
		measure($, one, thumbPath)
	)
	draftFacts.set(one.path, facts)
	return facts
}
