import { atom, read, update } from 'claude-code'
import type { Args, EngineInterface, Register } from 'claude-code'

import type { Attachment } from '../types'

import { parseIndex, withNew } from './archive'
import {
	mediaTypeOf,
	pendingAttachments,
	sourcePaths,
	textOf,
	withSources,
} from './capture'
import type { Pending } from './capture'
import { contextAround } from './context'
import { droppedPaths } from './dropped'
import { entryRow } from './entry-row'
import { promptRef } from './format'
import { stemOf } from './refs'
import { parseSize, sizeArgv, thumbArgv } from './sips'

const PANE = 'attachments'
const items = atom({ plugin: 'attachments', key: 'items' } as const, [])

let archiveDir = ''
let isPaneOffered = false

/** Opens the pane. A refusal to place it is swallowed, since the person can still open it with `/attachments`. */
const openPane = ($: EngineInterface) =>
	$.ui.open({ id: PANE, title: 'Attachments' }).catch(() => undefined)

/** Where an attachment's file goes in this session's archive folder. */
const pathOf = (one: Pending, rowId: string) =>
	`${archiveDir}/${one.stem}-${rowId.slice(0, 8)}.${one.extension}`

/** Writes the archive's entries beside its files, so a resumed session finds them again. Skipped when another session has started since `dir` was this one's, as the entries are then that session's. */
const persist = async ($: EngineInterface, dir = archiveDir) => {
	if (dir !== archiveDir) return
	await $.fs.write(
		`${dir}/index.json`,
		JSON.stringify(await read($, items), null, '\t')
	)
}

/** Runs a host command, treating one that cannot start (no `sips` off macOS) as a failed run. */
const tryRun = ($: EngineInterface, argv: string[], stdin?: string) =>
	$.process.run(argv, { stdin }).catch(() => ({ exitCode: -1, stdout: '' }))

/** Opens a file in its default app, or reveals it in Finder when no app takes it. */
const openOrReveal = async ($: EngineInterface, path: string) => {
	const opened = await tryRun($, ['open', path])
	if (opened.exitCode !== 0) await tryRun($, ['open', '-R', path])
}

/** Merges facts measured after listing into one entry. */
const patch = ($: EngineInterface, path: string, change: Partial<Attachment>) =>
	update($, items, (list) =>
		list.map((item) => (item.path === path ? { ...item, ...change } : item))
	)

/** Adds entries to the archive, and opens the pane on the session's first attachment only. */
const addEntries = async ($: EngineInterface, entries: Attachment[]) => {
	await update($, items, (current) => withNew(current, entries))
	if (isPaneOffered) return
	isPaneOffered = true
	void openPane($)
}

/** Writes a file's thumbnail and, for a picture, measures it. */
const thumbnail = async (
	$: EngineInterface,
	{ path, mediaType }: Pick<Attachment, 'path' | 'mediaType'>,
	thumbPath: string
) => {
	const [sized, thumbed] = await Promise.all([
		mediaType.startsWith('image/') ? tryRun($, sizeArgv(path)) : undefined,
		tryRun($, thumbArgv(path, thumbPath)),
	])
	await patch($, path, {
		...(sized && parseSize(sized.stdout)),
		...(thumbed.exitCode === 0 && { thumbPath }),
	})
}

/** Decodes one attachment to disk, since a pasted image exists only as base64 in the transcript. One that cannot be decoded is dropped, so no entry points at a missing file. */
const save = async ($: EngineInterface, one: Pending, path: string) => {
	const decoded = await tryRun($, ['base64', '-D', '-o', path], one.data)
	if (decoded.exitCode !== 0) {
		await update($, items, (list) => list.filter((item) => item.path !== path))
		return $.ui.log(`attachments: could not save ${one.ref}`)
	}

	const stat = await $.fs.stat(path).catch(() => undefined)
	if (stat) await patch($, path, { bytes: stat.size })
	await thumbnail(
		$,
		{ path, mediaType: one.mediaType },
		path.replace(/\.\w+$/, '.thumb.png')
	)
}

/** Turns a failed step into a log line, so one bad attachment never breaks the session it belongs to. */
const logFailure = ($: EngineInterface) => (error: unknown) =>
	$.ui.log(
		`attachments: ${error instanceof Error ? error.message : String(error)}`
	)

/** Saves listed attachments' files into the folder they were listed for, then records them in the index whether or not each save worked. */
const saveAll = async (
	$: EngineInterface,
	saves: { one: Pending; path: string }[],
	dir: string
) => {
	await tryRun($, ['mkdir', '-p', dir])
	const results = await Promise.allSettled(
		saves.map(({ one, path }) => save($, one, path))
	)
	results.forEach(
		(result) => result.status === 'rejected' && logFailure($)(result.reason)
	)
	await persist($, dir)
}

/** Lists a prompt's attachments now and saves their files in the background, so the meta row that follows can name them. */
const archive = async (
	$: EngineInterface,
	pending: Pending[],
	rowId: string
) => {
	const known = new Set((await read($, items)).map((item) => item.path))
	const saves = pending
		.map((one) => ({ one, path: pathOf(one, rowId) }))
		.filter(({ path }) => !known.has(path))
	if (saves.length === 0) return

	const addedAt = await $.clock.now()
	const entries: Attachment[] = saves.map(({ one, path }) => ({
		ref: one.ref,
		kind: one.kind,
		mediaType: one.mediaType,
		context: one.context,
		addedAt,
		path,
	}))
	await addEntries($, entries)
	void saveAll($, saves, archiveDir).catch(logFailure($))
}

/** Writes thumbnails for files that stay where they are into the folder they were listed for, then records them in the index. */
const thumbnailAll = async (
	$: EngineInterface,
	entries: Attachment[],
	rowId: string,
	dir: string
) => {
	await tryRun($, ['mkdir', '-p', dir])
	await Promise.allSettled(
		entries.map((entry) =>
			thumbnail(
				$,
				entry,
				`${dir}/${stemOf(entry.ref)}-${rowId.slice(0, 8)}.thumb.png`
			)
		)
	)
	await persist($, dir)
}

/** Lists the existing files a prompt names by absolute path. A dropped non-image reaches Claude only as that path. */
const trackFiles = async ($: EngineInterface, text: string, rowId: string) => {
	const paths = droppedPaths(text)
	const current = await read($, items)
	const known = new Set(current.map((item) => item.path))
	const found = await Promise.all(
		paths
			.filter((path) => !known.has(path))
			.map((path) =>
				$.fs.stat(path).then(
					(stat) => ({ path, stat }),
					() => undefined
				)
			)
	)
	const files = found.flatMap((one) =>
		one?.stat.kind === 'file' ? [{ path: one.path, bytes: one.stat.size }] : []
	)
	if (files.length === 0) return

	const count = current.filter((item) => item.kind === 'file').length
	const addedAt = await $.clock.now()
	const entries: Attachment[] = files.map(({ path, bytes }, index) => ({
		ref: `[File #${count + index + 1}]`,
		kind: 'file',
		mediaType: mediaTypeOf(path),
		filename: path.split('/').at(-1),
		context: contextAround(text, path),
		addedAt,
		path,
		bytes,
	}))
	await addEntries($, entries)
	void thumbnailAll($, entries, rowId, archiveDir).catch(logFailure($))
}

/** Archives a prompt row's images and the files its paths name. A meta row after a dropped image names that image from its source path. */
const track = async (
	$: EngineInterface,
	{ message, uuid }: Args<'session.append'>
) => {
	if (!message.isMeta) {
		await archive(
			$,
			pendingAttachments(message.content, (await read($, items)).length),
			uuid
		)
		return trackFiles($, textOf(message.content), uuid)
	}

	const paths = sourcePaths(textOf(message.content))
	if (paths.length === 0) return
	await update($, items, (list) => withSources(list, paths))
	await persist($)
}

/** Archives every image and file the person puts in the session's main conversation, and lists them in a pane. */
export const register: Register = (on) => {
	on('session.start', async ($, e, next) => {
		archiveDir = `${await $.env.get('HOME')}/.claude/attachments/${await $.session.id()}`
		isPaneOffered = false
		const stored = await $.fs.read(`${archiveDir}/index.json`).catch(() => '[]')
		await update($, items, () => parseIndex(stored))
		await $.command.register({
			name: 'attachments',
			description: 'Open the archive of everything attached to this session',
		})

		return next(e)
	})

	on('session.append', async ($, e, next) => {
		const result = await next(e)
		if (!e.agentId && e.message.type === 'user')
			await track($, e).catch(logFailure($))
		return result
	})

	on('command.run', { command: 'attachments' }, async ($) => {
		await openPane($)

		return { text: 'Attachments pane opened.' }
	})

	on('ui.message', async ($, e, next) => {
		if (e.requestId !== PANE || !e.element.startsWith('thumb:')) return next(e)

		const path = e.element.slice('thumb:'.length)
		const item = (await read($, items)).find((one) => one.path === path)
		if (item) await openOrReveal($, item.path)
		return {}
	})

	on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
		const ui = $.ui.resolve(e)
		const { Box, Text } = ui
		const list = (await read($, items)).toReversed()
		const insertRef = (item: Attachment) => () =>
			// oxlint-disable-next-line unicorn/no-array-fill-with-reference-type -- $.prompt.fill fills the prompt box, not an array
			void $.prompt.fill({ text: promptRef(item), mode: 'insert' })

		return (
			<Box flexDirection="column" paddingTop={1} paddingX={2}>
				{list.length === 0 && (
					<Text dimColor>
						Nothing attached yet. Paste or drop an image into the prompt.
					</Text>
				)}
				{list.map((item) => entryRow(ui, item, insertRef(item)))}
			</Box>
		)
	})
}
