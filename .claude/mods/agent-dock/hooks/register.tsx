import { atom, read, update } from 'claude-code'
import type {
	EngineInterface,
	Register,
	RenderInput,
	RenderNode,
} from 'claude-code'

import {
	archiveFinished,
	autoArchive,
	hasPendingArchive,
	listedRows,
	newFailures,
	setAutoArchive,
} from './archive'
import { bufferTaskEnd, bufferText, bufferUsage, drainBuffers } from './buffers'
import { foldTick, hasWork, withSpawn, withToolCall } from './feed'
import { frontmatterColor } from './format'
import {
	claimOwnPaneOffer,
	lastTranscriptSize,
	markHostDrawn,
	markLoaded,
	paneSize,
	rememberTranscriptSize,
	setHostPane,
} from './own-pane'
import { restoreRows, storedRows, withStoredRows } from './persist'
import { SCROLLBAR_COLUMNS } from './scrollbar'
import { backgroundTaskId, unlistedShells, withShell } from './shells'
import {
	DEFAULT_SHARE,
	isListScroll,
	scrolledOffset,
	parseDividerMessage,
	parseShare,
	shareAfterDrag,
	splitProps,
} from './split'
import { splitPane } from './split-pane'
import { transcriptLines } from './transcript-lines'
import { transcriptRows, visibleTranscriptRows } from './transcript-rows'

const agents = atom({ plugin: 'agent-dock', key: 'agents' } as const, [])
const view = atom({ plugin: 'agent-dock', key: 'view' } as const, {
	selected: null,
	offset: 0,
})
const share = atom(
	{ plugin: 'agent-dock', key: 'share' } as const,
	DEFAULT_SHARE
)
const shimmer = atom({ plugin: 'agent-dock', key: 'shimmer' } as const, 0)

const OWN_PANE = 'agents'
const TICK_MS = 1000
// Redrawing the pane per frame also redraws the host's tree, so the shimmer steps slowly.
const SHIMMER_MS = 150
const STORE_KEY = 'sessions'

let sessionId = ''
let persisted = ''

/** Opens agent-dock's own pane, swallowing a refusal: an unplaced pane is the person's to open with `/agents`. */
const openOwnPane = ($: EngineInterface) =>
	$.ui.open({ id: OWN_PANE, title: 'Agents' }).catch(() => undefined)

/** The color the agent's own file names for its type, looked up in the project's and then the user's agents folder; a spawn is never held up by a missing file. */
const fileColorOf = async ($: EngineInterface, type: string) => {
	const folders = await Promise.all([
		$.session.root().then((root) => `${root}/.claude/agents`),
		$.env.get('HOME').then((home) => `${home ?? ''}/.claude/agents`),
	]).catch(() => [])
	const files = await Promise.all(
		folders.map((folder) =>
			$.fs.read(`${folder}/${type}.md`).catch(() => undefined)
		)
	)

	return files
		.map((markdown) => (markdown ? frontmatterColor(markdown) : undefined))
		.find((color) => color !== undefined)
}

/** Ends shells the engine no longer lists as in flight, the only word a shell gives when its notification never arrives. */
const endUnlistedShells = async (
	$: EngineInterface,
	inFlight: readonly { id: string }[] | undefined
) => {
	if (inFlight === undefined) return

	unlistedShells(await read($, agents), inFlight).forEach((row) =>
		bufferTaskEnd(row.id, 'completed')
	)
}

/** Keeps the session's rows in the store, so a resumed session shows them again; the engine forgets its agents with the process. */
const persistRows = async ($: EngineInterface) => {
	const rows = await read($, agents)
	const serialized = JSON.stringify(rows)
	if (sessionId === '' || serialized === persisted) return

	persisted = serialized
	await $.store.set(
		STORE_KEY,
		withStoredRows(await $.store.get(STORE_KEY), sessionId, rows)
	)
}

/** Folds the engine's agent list, streamed text and ended tasks into the rows, then opens the own pane if there are rows and no host. */
const pulse = async ($: EngineInterface) => {
	const listed = await $.agent.list()
	const rows = await read($, agents)
	const at = await $.clock.now()
	if (!hasWork(rows, listed) && !hasPendingArchive(rows)) {
		if (rows.length > 0 && claimOwnPaneOffer(at)) await openOwnPane($)
		return
	}

	const drained = drainBuffers()
	newFailures(rows, listed).forEach((info) =>
		$.ui.toast(`agent-dock: ${info.type} "${info.description}" ${info.status}`)
	)
	await update($, agents, (current) =>
		autoArchive(foldTick(current, listed, drained, at), at)
	)
	await persistRows($)
	if (claimOwnPaneOffer(at)) await openOwnPane($)
}

/** Advances the shimmer one step while any agent is running; a pane with none running is left alone. */
const shimmerStep = async ($: EngineInterface) => {
	const rows = await read($, agents)
	if (!rows.some((row) => row.status === 'running')) return

	await update($, shimmer, (phase) => phase + 1)
}

/** Reads the agents and, when one is open, its transcript lines. */
const readView = async ($: EngineInterface) => {
	const rows = await read($, agents)
	const { selected, offset, isArchiveOpen = false } = await read($, view)
	const openRow = rows.find((row) => row.id === selected)
	if (!openRow) return { rows, offset, isArchiveOpen, opened: undefined }

	// A shell has no transcript of its own to read.
	const lines =
		openRow.kind === 'shell'
			? []
			: transcriptLines(await $.session.messages({ agentId: openRow.id }))
	return { rows, offset, isArchiveOpen, opened: { row: openRow, lines } }
}

/** Draws the agent list into a terminal pane, under the host pane's own tree when one is given. */
const drawAgents = async (
	$: EngineInterface,
	e: RenderInput<'Pane', 'terminal' | 'desktop'>,
	tree?: RenderNode,
	treeRows = 0
) => {
	const size = paneSize(e.props)
	// The scroll hook clamps against the room this draw had, so it must be recorded here.
	rememberTranscriptSize({
		columns: size.bodyColumns - SCROLLBAR_COLUMNS,
		visibleRows: visibleTranscriptRows(
			size.bodyRows,
			tree === undefined ? 0 : treeRows
		),
	})

	return splitPane({
		ui: $.ui.resolve(e),
		tree,
		...(await readView($)),
		now: await $.clock.now(),
		...size,
		phase: await read($, shimmer),
		treeRows,
		select: (id) => () =>
			void update($, view, (current) => ({
				...current,
				selected: id,
				offset: 0,
			})),
		archive: {
			isOpen: (await read($, view)).isArchiveOpen ?? false,
			toggle: () =>
				void update($, view, (current) => ({
					...current,
					offset: 0,
					isArchiveOpen: !current.isArchiveOpen,
				})),
			archiveFinished: () =>
				void update($, agents, (rows) => archiveFinished(rows)),
		},
	})
}

/** Feeds the agent list from engine events and draws it in the host pane, or in its own pane where there is none. */
export const register: Register = (on, options) => {
	const hostPane = setHostPane(options.hostPane)
	setAutoArchive(options.autoArchiveMinutes)

	on('session.start', async ($, e, next) => {
		const at = await $.clock.now()
		markLoaded(at)
		const stored = parseShare(await $.store.get('share'))
		await update($, share, () => stored)

		// A hot reload keeps the rows; only a fresh process starts empty and takes them from the store.
		sessionId = await $.session.id()
		persisted = ''
		if ((await read($, agents)).length === 0) {
			const restored = restoreRows(
				storedRows(await $.store.get(STORE_KEY), sessionId),
				at
			)
			await update($, agents, () => restored)
		}
		$.clock.every(TICK_MS, () => void pulse($))
		$.clock.every(SHIMMER_MS, () => void shimmerStep($))
		await $.command.register({
			name: 'agents',
			description: "Open agent-dock's own pane of this session's subagents",
		})

		return next(e)
	})

	on('agent.spawn', async ($, e, next) => {
		const result = await next(e)
		const agentId = 'agentId' in result ? result.agentId : undefined
		if (!agentId) return result

		const startedAt = await $.clock.now()
		const color = await fileColorOf($, e.subagentType)
		await update($, agents, (rows) =>
			withSpawn(rows, agentId, e, startedAt, color)
		)

		return result
	})

	on('tool.call', async ($, e, next) => {
		const agentId = e.agentId
		if (agentId)
			await update($, agents, (rows) => withToolCall(rows, agentId, e))

		const result = await next(e)
		if (e.tool !== 'Bash') return result

		const taskId = backgroundTaskId(result.result)
		if (!taskId) return result

		const startedAt = await $.clock.now()
		await update($, agents, (rows) =>
			withShell(rows, taskId, e, startedAt, agentId)
		)

		return result
	})

	on(
		'ui.render',
		{
			component: 'UserMessage',
			props: { origin: { kind: 'task-notification' } },
		},
		(_$, e, next) => {
			const { id, status } = e.props.task ?? {}
			if (id && status) bufferTaskEnd(id, status)

			return next(e)
		}
	)

	on('turn.step', async function* ($, e, next) {
		for await (const chunk of next(e)) {
			if (e.agentId && chunk.kind === 'text') bufferText(e.agentId, chunk.text)
			if (e.agentId && chunk.kind === 'stop' && chunk.usage)
				bufferUsage(e.agentId, chunk.usage)
			yield chunk
		}
	})

	on('classic.Stop', async ($, e, next) => {
		await endUnlistedShells($, e.background_tasks)

		return next(e)
	})

	on('command.run', { command: 'agents' }, async ($) => {
		await openOwnPane($)

		return { text: 'Agents pane opened.' }
	})

	on('ui.message', async ($, e, next) => {
		const message =
			e.element === 'divider' ? parseDividerMessage(e.data) : undefined
		if (!message) return next(e)

		if (message.moveBy !== 0)
			await update($, share, (current) =>
				shareAfterDrag(current, message.bodyRows, message.moveBy)
			)
		if (message.isDone) await $.store.set('share', await read($, share))
		return {}
	})

	// Wheel ticks over the agent list scroll it; the rest of the pane, the host's tree, keeps its own scrolling.
	on('ui.scroll', { component: 'Pane' }, async ($, e, next) => {
		const panes = { host: hostPane, own: OWN_PANE }
		const { rows, opened, isArchiveOpen } = await readView($)
		if (rows.length === 0 || !isListScroll(e, panes, await read($, share)))
			return next(e)

		const { columns, visibleRows } = lastTranscriptSize()
		const hiddenAbove = opened
			? Math.max(
					0,
					transcriptRows(opened.row, opened.lines, 0, columns).length -
						visibleRows
				)
			: 0
		const count = opened
			? hiddenAbove + 1
			: listedRows(rows, isArchiveOpen).length
		// A transcript is anchored at its newest row, so scrolling down moves toward it.
		const by = opened ? -e.by : e.by
		await update($, view, (current) => ({
			...current,
			offset: scrolledOffset(current.offset, by, count),
		}))
		return {}
	})

	// A host that draws without calling next (filetree does) never reaches this hook unless agent-dock is listed before it in enabledPlugins.
	on('ui.render', { component: 'Pane' }, async ($, e, next) => {
		const isOwn = e.requestId === OWN_PANE
		if (e.requestId === hostPane) markHostDrawn()
		if (
			(e.surface !== 'terminal' && e.surface !== 'desktop') ||
			(!isOwn && e.requestId !== hostPane)
		)
			return next(e)
		if (isOwn) return drawAgents($, e)
		if ((await read($, agents)).length === 0) return next(e)

		const { treeRows, props } = splitProps(e.props, await read($, share))
		return drawAgents($, e, await next({ ...e, props }), treeRows)
	})
}
