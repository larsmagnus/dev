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
import {
	bufferText,
	drainText,
	foldTick,
	hasWork,
	transcriptLines,
	withSpawn,
	withToolCall,
} from './feed'
import {
	claimOwnPaneOffer,
	markHostDrawn,
	markLoaded,
	paneSize,
	setHostPane,
} from './own-pane'
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

const agents = atom({ plugin: 'agent-dock', key: 'agents' } as const, [])
const view = atom({ plugin: 'agent-dock', key: 'view' } as const, {
	selected: null,
	offset: 0,
})
const share = atom(
	{ plugin: 'agent-dock', key: 'share' } as const,
	DEFAULT_SHARE
)

const OWN_PANE = 'agents'
const TICK_MS = 1000

/** Opens agent-dock's own pane, swallowing a refusal: an unplaced pane is the person's to open with `/agents`. */
const openOwnPane = ($: EngineInterface) =>
	$.ui.open({ id: OWN_PANE, title: 'Agents' }).catch(() => undefined)

/** Folds the engine's agent list and streamed text into the rows, then opens the own pane if live agents have no host. */
const pulse = async ($: EngineInterface) => {
	const listed = await $.agent.list()
	const rows = await read($, agents)
	if (!hasWork(rows, listed) && !hasPendingArchive(rows)) return

	const at = await $.clock.now()
	const drained = drainText()
	newFailures(rows, listed).forEach((info) =>
		$.ui.toast(`agent-dock: ${info.type} "${info.description}" ${info.status}`)
	)
	await update($, agents, (current) =>
		autoArchive(foldTick(current, listed, drained, at), at)
	)
	if (claimOwnPaneOffer(at)) await openOwnPane($)
}

/** Reads the agents and, when one is open, its transcript lines. */
const readView = async ($: EngineInterface) => {
	const rows = await read($, agents)
	const { selected, offset, isArchiveOpen = false } = await read($, view)
	const openRow = rows.find((row) => row.id === selected)
	if (!openRow) return { rows, offset, isArchiveOpen, opened: undefined }

	const lines = transcriptLines(
		await $.session.messages({ agentId: openRow.id })
	)
	return { rows, offset, isArchiveOpen, opened: { row: openRow, lines } }
}

/** Draws the agent list into a terminal pane, under the host pane's own tree when one is given. */
const drawAgents = async (
	$: EngineInterface,
	e: RenderInput<'Pane', 'terminal' | 'desktop'>,
	tree?: RenderNode,
	treeRows = 0
) =>
	splitPane({
		ui: $.ui.resolve(e),
		tree,
		...(await readView($)),
		now: await $.clock.now(),
		...paneSize(e.props),
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

/** Feeds the agent list from engine events and draws it in the host pane, or in its own pane where there is none. */
export const register: Register = (on, options) => {
	const hostPane = setHostPane(options.hostPane)
	setAutoArchive(options.autoArchiveMinutes)

	on('session.start', async ($, e, next) => {
		markLoaded(await $.clock.now())
		const stored = parseShare(await $.store.get('share'))
		await update($, share, () => stored)
		$.clock.every(TICK_MS, () => void pulse($))
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
		await update($, agents, (rows) => withSpawn(rows, agentId, e, startedAt))

		return result
	})

	on('tool.call', async ($, e, next) => {
		const agentId = e.agentId
		if (agentId)
			await update($, agents, (rows) => withToolCall(rows, agentId, e))

		return next(e)
	})

	on('turn.step', async function* ($, e, next) {
		for await (const chunk of next(e)) {
			if (e.agentId && chunk.kind === 'text') bufferText(e.agentId, chunk.text)
			yield chunk
		}
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

		const count = opened
			? opened.lines.length
			: listedRows(rows, isArchiveOpen).length
		await update($, view, (current) => ({
			...current,
			offset: scrolledOffset(current.offset, e.by, count),
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
