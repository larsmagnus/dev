import type {
	AgentInfo,
	On,
	RenderPropsOf,
	SessionMessage,
	UiScrollInput,
} from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

const paneProps = {
	title: 'Files',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']
// A short body so a transcript has more lines than it shows: 5 tree rows, 3 transcript rows.
const shortPaneProps = {
	...paneProps,
	scroll: { offset: 0, bodyRows: 10 },
} satisfies RenderPropsOf['Pane']

const threeAgents: AgentInfo[] = [
	{
		id: 'agent-1',
		type: 'Explore',
		description: 'Find auth callers',
		status: 'running',
	},
	{
		id: 'agent-2',
		type: 'Plan',
		description: 'Outline the migration',
		status: 'running',
	},
	{
		id: 'agent-3',
		type: 'general-purpose',
		description: 'Run the test suite',
		status: 'running',
	},
]
const transcriptOf = (count: number): SessionMessage[] =>
	Array.from({ length: count }, (_, i) => ({
		role: 'assistant',
		text: `Checked module ${i + 1}`,
		toolUses: [],
	}))

function world(
	on: On,
	transcripts: Record<string, SessionMessage[]> = {},
	agents: AgentInfo[] = threeAgents
) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	const reachedHost: UiScrollInput[] = []
	mock.store(on)
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('agent.list', () => ({ value: agents }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('session.messages', (_$, e) => ({
		value: transcripts[e.agentId ?? ''] ?? { deny: `unknown ${e.agentId}` },
	}))
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	// Stands in for the host's own scrolling, which the dock must leave alone.
	on('ui.scroll', (_$, e) => {
		reachedHost.push(e)
		return {}
	})
	return { clock, reachedHost }
}

/** One agent per second, so the three have distinct start times, oldest first. */
const startSession = async (
	$: Engine,
	clock: { advance: (ms: number) => Promise<void> }
) => {
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	await clock.advance(1000)
}
const mountPane = (
	$: Engine,
	requestId: string,
	props: RenderPropsOf['Pane'] = paneProps
) =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId,
		props,
	})
const wheel = (
	requestId: string,
	by: number,
	pointer: { column: number; row: number } | undefined,
	bodyRows = 40
): UiScrollInput => ({
	component: 'Pane',
	requestId,
	offset: 0,
	by,
	bodyRows,
	contentRows: bodyRows,
	origin: { kind: 'person' },
	pointer,
})
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

test('should scroll the agent list when the wheel turns over it in the host pane', async ($, on) => {
	const { clock, reachedHost } = world(on)
	await startSession($, clock)
	const ui = await mountPane($, 'filetree')
	expect(await shown(ui)).toContain('Run the test suite')

	const result = await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 25 }))
	await ui.redraw()
	const drawn = await shown(ui)

	expect(result).toEqual({})
	expect(reachedHost).toEqual([])
	expect(drawn).not.toContain('Run the test suite')
	expect(drawn).toContain('Outline the migration')
	await ui.unmount()
})

test('should hand a wheel tick over the host tree to the host and leave the list where it is', async ($, on) => {
	const { clock, reachedHost } = world(on)
	await startSession($, clock)
	const ui = await mountPane($, 'filetree')

	await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 5 }))
	await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 20 }))
	await ui.redraw()

	expect(reachedHost.map((e) => e.pointer?.row)).toEqual([5, 20])
	expect(await shown(ui)).toContain('Run the test suite')
	await ui.unmount()
})

test('should hand a wheel tick with no pointer or for another pane to the next hook', async ($, on) => {
	const { clock, reachedHost } = world(on)
	await startSession($, clock)
	const ui = await mountPane($, 'filetree')

	await $.ui.scroll(wheel('filetree', 1, undefined))
	await $.ui.scroll(wheel('notes', 1, { column: 5, row: 25 }))

	expect(reachedHost.map((e) => e.requestId)).toEqual(['filetree', 'notes'])
	await ui.unmount()
})

test('should hand a wheel tick to the next hook when no agents exist', async ($, on) => {
	const { clock, reachedHost } = world(on, {}, [])
	await startSession($, clock)

	await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 25 }))

	expect(reachedHost.map((e) => e.requestId)).toEqual(['filetree'])
})

test('should scroll the agent list when the wheel turns below the divider in the agents pane', async ($, on) => {
	const { clock, reachedHost } = world(on)
	await startSession($, clock)
	const ui = await mountPane($, 'agents')

	const onDivider = await $.ui.scroll(wheel('agents', 1, { column: 5, row: 0 }))
	expect(reachedHost.map((e) => e.pointer?.row)).toEqual([0])
	expect(onDivider).toEqual({})
	expect(await shown(ui)).toContain('Run the test suite')

	await $.ui.scroll(wheel('agents', 1, { column: 5, row: 1 }))
	await ui.redraw()
	const drawn = await shown(ui)

	expect(reachedHost).toHaveLength(1)
	expect(drawn).not.toContain('Run the test suite')
	expect(drawn).toContain('Outline the migration')
	await ui.unmount()
})

test('should keep the list offset between the first agent and the last', async ($, on) => {
	const { clock } = world(on)
	await startSession($, clock)
	const ui = await mountPane($, 'filetree')

	await $.ui.scroll(wheel('filetree', 50, { column: 5, row: 25 }))
	await ui.redraw()
	const atEnd = await shown(ui)
	expect(atEnd).not.toContain('Outline the migration')
	expect(atEnd).toContain('Find auth callers')

	await $.ui.scroll(wheel('filetree', -50, { column: 5, row: 25 }))
	await ui.redraw()
	const atStart = await shown(ui)
	expect(atStart).toContain('Run the test suite')
	expect(atStart).toContain('Find auth callers')
	await ui.unmount()
})

test('should scroll back through a transcript from its newest line', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(8) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)
	await ui.press({ key: 'open:agent-2' })
	const newest = await shown(ui)
	expect(newest).toContain('Checked module 8')
	expect(newest).not.toContain('Checked module 5')

	await $.ui.scroll(wheel('filetree', 3, { column: 5, row: 7 }, 10))
	await ui.redraw()
	const earlier = await shown(ui)

	expect(earlier).not.toContain('Checked module 8')
	expect(earlier).toContain('Checked module 5')

	await $.ui.scroll(wheel('filetree', 50, { column: 5, row: 7 }, 10))
	await ui.redraw()
	expect(await shown(ui)).toContain('Checked module 1')
	await ui.unmount()
})

test('should reset the offset when a transcript is opened and when it is closed', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(8) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)

	await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 7 }, 10))
	await ui.redraw()
	await ui.press({ key: 'open:agent-2' })
	expect(await shown(ui)).toContain('Checked module 8')

	await $.ui.scroll(wheel('filetree', 3, { column: 5, row: 7 }, 10))
	await ui.redraw()
	expect(await shown(ui)).not.toContain('Checked module 8')
	await ui.press({ key: 'back' })

	const list = await shown(ui)
	expect(list).toContain('Run the test suite')
	expect(list).toContain('Outline the migration')
	await ui.unmount()
})

test('should scroll the agent list on scroll keys with no pointer in the agents pane', async ($, on) => {
	const { clock, reachedHost } = world(on)
	await startSession($, clock)
	const ui = await mountPane($, 'agents')
	expect(await shown(ui)).toContain('Run the test suite')

	const result = await $.ui.scroll(wheel('agents', 1, undefined))
	await ui.redraw()
	const drawn = await shown(ui)

	expect(result).toEqual({})
	expect(reachedHost).toEqual([])
	expect(drawn).not.toContain('Run the test suite')
	expect(drawn).toContain('Outline the migration')
	await ui.unmount()
})

test('should hand scroll keys with no pointer in the host pane to the next hook and leave the list where it is', async ($, on) => {
	const { clock, reachedHost } = world(on)
	await startSession($, clock)
	const ui = await mountPane($, 'filetree')

	await $.ui.scroll(wheel('filetree', 1, undefined))
	await ui.redraw()

	expect(reachedHost.map((e) => e.requestId)).toEqual(['filetree'])
	expect(await shown(ui)).toContain('Run the test suite')
	await ui.unmount()
})

test('should scroll down to archived agents with scroll keys while the archive is open', async ($, on) => {
	const agents: AgentInfo[] = [threeAgents[0]!, threeAgents[1]!]
	const { clock } = world(on, {}, agents)
	await startSession($, clock)
	agents[0] = { ...threeAgents[0]!, status: 'completed' }
	agents[1] = { ...threeAgents[1]!, status: 'completed' }
	await clock.advance(1000)
	const ui = await mountPane($, 'agents')
	await ui.press({ key: 'archive:finished' })
	await ui.press({ key: 'archive:toggle' })
	expect(await shown(ui)).toContain('Find auth callers')

	await $.ui.scroll(wheel('agents', 1, undefined))
	await ui.redraw()
	const drawn = await shown(ui)

	expect(drawn).not.toContain('Outline the migration')
	expect(drawn).toContain('Find auth callers')
	await ui.unmount()
})

test('should wrap transcript lines and show only the newest ones that fit the pane', async ($, on) => {
	const transcript: SessionMessage[] = [
		'Start the review',
		'Reviewed every route handler that reads the session cookie',
		'Checked the session middleware',
		'Done',
	].map((text) => ({ role: 'assistant', text, toolUses: [] }))
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	// 10 body rows: 5 tree rows leave 3 transcript rows; at 20 columns the lines are 1, 3, 2 and 1 rows high.
	const ui = await mountPane($, 'filetree', {
		...shortPaneProps,
		bodyColumns: 20,
	})

	await ui.press({ key: 'open:agent-2' })
	const drawn = await shown(ui)

	expect(drawn).toContain('"wrap":"wrap"')
	expect(drawn).toContain('Done')
	expect(drawn).toContain('Checked the session middleware')
	expect(drawn).not.toContain('Reviewed every route handler')
	await ui.unmount()
})

test('should show a line exactly as wide as the pane on a single row', async ($, on) => {
	const transcript: SessionMessage[] = [
		'Reviewed all routes.',
		'Checked every guard.',
	].map((text) => ({ role: 'assistant', text, toolUses: [] }))
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', {
		...shortPaneProps,
		bodyColumns: 20,
	})

	await ui.press({ key: 'open:agent-2' })
	const drawn = await shown(ui)

	expect(drawn).toContain('Reviewed all routes.')
	expect(drawn).toContain('Checked every guard.')
	await ui.unmount()
})
