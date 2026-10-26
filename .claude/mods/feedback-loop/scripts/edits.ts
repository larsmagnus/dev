import { readFile, realpath, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { isRecord } from '../hooks/parse.ts'

import { HOME } from './store.ts'

export type Edit = { file: string; find: string; replace: string }
export type Outcome = {
	key: string
	outcome: 'applied' | 'skipped'
	note: string
	edits: Edit[]
}

/** Narrows one proposed text replacement. */
const isEdit = (value: unknown): value is Edit =>
	isRecord(value) &&
	typeof value.file === 'string' &&
	typeof value.find === 'string' &&
	typeof value.replace === 'string'

/** Narrows one model result row. */
export const isOutcome = (value: unknown): value is Outcome =>
	isRecord(value) &&
	typeof value.key === 'string' &&
	(value.outcome === 'applied' || value.outcome === 'skipped') &&
	typeof value.note === 'string' &&
	Array.isArray(value.edits) &&
	value.edits.every(isEdit)

/** Whether `file` lies strictly inside `root`; `..notes.md` is inside, `../x` is not. */
const isInside = (root: string, file: string) => {
	const path = relative(root, file)
	return (
		path !== '' &&
		path !== '..' &&
		!path.startsWith(`..${sep}`) &&
		!isAbsolute(path)
	)
}

/** Resolves a proposed file through symlinks and rejects any that leave a project or `~/.claude`. */
async function allowedPath(edit: Edit, roots: string[]) {
	const file = await realpath(resolve(edit.file))
	const real = await Promise.all(
		[...roots, join(HOME, '.claude')].map((root) =>
			realpath(root).catch(() => root)
		)
	)
	if (!real.some((root) => isInside(root, file)))
		throw new Error(`${edit.file} is outside the project`)

	return file
}

/** Applies one edit to text. An empty `find` appends on its own line; otherwise `find` must match exactly once. */
function applyEdit(text: string, edit: Edit) {
	if (edit.find === '')
		return `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${edit.replace}`

	const parts = text.split(edit.find)
	if (parts.length !== 2)
		throw new Error(
			`text to replace matches ${parts.length - 1}x in ${edit.file}`
		)

	return parts.join(edit.replace)
}

/** Applies an outcome's edits in memory, then writes, so a failing edit leaves every file untouched and the suggestion pending with the reason. An `applied` outcome without edits changed nothing, so it is a skip. */
export async function commit(
	outcome: Outcome,
	roots: string[]
): Promise<Outcome> {
	if (outcome.outcome === 'skipped') return outcome
	if (outcome.edits.length === 0)
		return { ...outcome, outcome: 'skipped', note: 'no edits proposed' }

	try {
		const texts = new Map<string, string>()
		for (const edit of outcome.edits) {
			// Sequential: later edits must see earlier ones' text.
			// oxlint-disable-next-line no-await-in-loop
			const file = await allowedPath(edit, roots)
			// oxlint-disable-next-line no-await-in-loop
			const text = texts.get(file) ?? (await readFile(file, 'utf8'))
			texts.set(file, applyEdit(text, edit))
		}
		await Promise.all([...texts].map(([file, text]) => writeFile(file, text)))
		return outcome
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error)
		return { ...outcome, outcome: 'skipped', note: `write failed: ${reason}` }
	}
}
