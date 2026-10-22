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
// A short body so details and transcript together outrun the pane: 9 tree rows leave 7 rows under the back button.
const shortPaneProps = {
	...paneProps,
	scroll: { offset: 0, bodyRows: 22 },
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
	mock.store(on, { host: 'filetree' })
	const reachedHost: UiScrollInput[] = []
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-4f2a9c' }))
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

test('should scroll back through a transcript when the wheel turns up from its newest line', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(8) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)
	await ui.press({ key: 'open:agent-2' })
	const newest = await shown(ui)
	expect(newest).toContain('Checked module 8')
	expect(newest).toContain('Checked module 2')
	expect(newest).not.toContain('Checked module 1')

	await $.ui.scroll(wheel('filetree', -3, { column: 5, row: 12 }, 22))
	await ui.redraw()
	const earlier = await shown(ui)

	expect(earlier).not.toContain('Checked module 8')
	expect(earlier).toContain('Checked module 5')
	expect(earlier).toContain('Checked module 1')

	await $.ui.scroll(wheel('filetree', -50, { column: 5, row: 12 }, 22))
	await ui.redraw()
	const oldest = await shown(ui)
	expect(oldest).toContain('Checked module 1')
	expect(oldest).not.toContain('Checked module 8')
	await ui.unmount()
})

test('should leave a transcript unchanged when the wheel turns down at its newest line', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(8) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)
	await ui.press({ key: 'open:agent-2' })
	const before = await shown(ui)

	await $.ui.scroll(wheel('filetree', 3, { column: 5, row: 12 }, 22))
	await ui.redraw()

	const after = await shown(ui)
	expect(before).toContain('Checked module 2')
	expect(before).toContain('Checked module 8')
	expect(before).toContain('Status  running')
	expect(after).toContain('Checked module 2')
	expect(after).toContain('Checked module 8')
	expect(after).toContain('Status  running')
	await ui.unmount()
})

test('should bring the id line into view while the back button, status and start stay pinned when the wheel turns up on a long transcript', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(8) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)
	await ui.press({ key: 'open:agent-2' })
	const newest = await shown(ui)
	expect(newest).toContain('Status  running')
	expect(newest).toContain('Started ')
	expect(newest).not.toContain('Id      agent-2')
	expect(newest).toContain('← Plan Outline the migration')

	await $.ui.scroll(wheel('filetree', -50, { column: 5, row: 12 }, 22))
	await ui.redraw()
	const drawn = await shown(ui)

	expect(drawn).toContain('Status  running')
	expect(drawn).toContain('Id      agent-2')
	expect(drawn).toContain('← Plan Outline the migration')
	await ui.unmount()
})

test('should keep every line of a transcript that fits the pane when the wheel turns up', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(3) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree')
	await ui.press({ key: 'open:agent-2' })

	await $.ui.scroll(wheel('filetree', -5, { column: 5, row: 25 }))
	await ui.redraw()
	const drawn = await shown(ui)

	expect(drawn).toContain('Checked module 1')
	expect(drawn).toContain('Checked module 2')
	expect(drawn).toContain('Checked module 3')
	await ui.unmount()
})

test('should move back toward the newest row on the first wheel tick down after scrolling to the oldest', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(8) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)
	await ui.press({ key: 'open:agent-2' })
	await $.ui.scroll(wheel('filetree', -50, { column: 5, row: 12 }, 22))
	await ui.redraw()
	const atOldest = await shown(ui)
	expect(atOldest).toContain('Status  running')
	expect(atOldest).toContain('Checked module 5')
	expect(atOldest).not.toContain('Checked module 6')

	await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 12 }, 22))
	await ui.redraw()
	const nearer = await shown(ui)

	expect(nearer).toContain('Status  running')
	expect(nearer).toContain('Id      agent-2')
	expect(nearer).toContain('Checked module 6')
	expect(nearer).not.toContain('Checked module 7')
	await ui.unmount()
})

test('should reset the offset when a transcript is opened and when it is closed', async ($, on) => {
	const { clock } = world(on, { 'agent-2': transcriptOf(8) })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)

	await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 12 }, 22))
	await ui.redraw()
	await ui.press({ key: 'open:agent-2' })
	expect(await shown(ui)).toContain('Checked module 8')

	await $.ui.scroll(wheel('filetree', -3, { column: 5, row: 12 }, 22))
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

test('should wrap transcript lines and show only the newest rows that fit the pane', async ($, on) => {
	const transcript: SessionMessage[] = [
		'Start the review',
		'Reviewed every route handler that reads the session cookie',
		'Checked the session middleware',
		'Done',
	].map((text) => ({ role: 'assistant', text, toolUses: [] }))
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	// 14 body rows: 7 tree rows leave 5 rows under the back button; the scrollbar takes 1 of 21 columns, so at 20 text columns the lines are 1, 3, 2 and 1 rows high, so the 5 newest rows end inside the 3-row line.
	const ui = await mountPane($, 'filetree', {
		...shortPaneProps,
		scroll: { offset: 0, bodyRows: 18 },
		bodyColumns: 23,
	})

	await ui.press({ key: 'open:agent-2' })
	const drawn = await shown(ui)

	expect(drawn).toContain('the session cookie')
	expect(drawn).toContain('Checked the session')
	expect(drawn).toContain('middleware')
	expect(drawn).toContain('Done')
	expect(drawn).not.toContain('Reviewed every route')
	expect(drawn).not.toContain('Start the review')
	await ui.unmount()
})

test('should show a line exactly as wide as the text area beside the scrollbar on a single row', async ($, on) => {
	const transcript: SessionMessage[] = [
		'Reviewed all routes.',
		'Checked every guard.',
	].map((text) => ({ role: 'assistant', text, toolUses: [] }))
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', {
		...shortPaneProps,
		scroll: { offset: 0, bodyRows: 26 },
		bodyColumns: 23,
	})

	await ui.press({ key: 'open:agent-2' })
	const drawn = await shown(ui)

	expect(drawn).toContain('Reviewed all routes.')
	expect(drawn).toContain('Checked every guard.')
	await ui.unmount()
})

test('should show the newest rows of a message taller than the pane, reach its start by scrolling up and keep the back button', async ($, on) => {
	const finalMessage = Array.from(
		{ length: 30 },
		(_, i) => `Route handler ${i + 1} validates the session cookie.`
	).join(' ')
	const transcript: SessionMessage[] = [
		'Start the review',
		`Audit complete: ${finalMessage}`,
	].map((text) => ({ role: 'assistant', text, toolUses: [] }))
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)

	await ui.press({ key: 'open:agent-2' })
	const newest = await shown(ui)

	expect(newest).toContain('← Plan Outline the migration')
	expect(newest).toContain('Route handler 30')
	expect(newest).toContain('session cookie.')
	expect(newest).not.toContain('Audit complete')
	expect(newest).not.toContain('…')

	// Far more ticks than the message has hidden rows above: the view stops where its first row leads.
	await $.ui.scroll(wheel('filetree', -21, { column: 5, row: 12 }, 22))
	await ui.redraw()
	const start = await shown(ui)

	expect(start).toContain('← Plan Outline the migration')
	expect(start).toContain('Audit complete: Route handler 1 validates')
	expect(start).not.toContain('Route handler 30')
	await ui.unmount()
})

test('should show only the newest rows when the newest line wraps to more rows than its length suggests', async ($, on) => {
	const transcript: SessionMessage[] = [
		'Start the review',
		'Reviewed every route handler',
		'authorizers middleware controllers validators',
		// Four words that cannot share a 20-column row: 4 rows, though ceil(45 / 20) is 3.
	].map((text) => ({ role: 'assistant', text, toolUses: [] }))
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	// 14 body rows leave 5 rows under the back button: the 4-row line and the last row of the 2-row line before it.
	const ui = await mountPane($, 'filetree', {
		...shortPaneProps,
		scroll: { offset: 0, bodyRows: 18 },
		bodyColumns: 23,
	})

	await ui.press({ key: 'open:agent-2' })
	const drawn = await shown(ui)

	for (const word of ['authorizers', 'middleware', 'controllers', 'validators'])
		expect(drawn).toContain(word)
	expect(drawn).not.toContain('Reviewed every route')
	expect(drawn).not.toContain('Start the review')
	await ui.unmount()
})

test('should move the view by exactly one row per wheel tick inside a single long message', async ($, on) => {
	const message = Array.from(
		{ length: 30 },
		(_, i) => `Route handler ${i + 1} validates the session cookie.`
	).join(' ')
	const transcript: SessionMessage[] = [
		{ role: 'assistant', text: message, toolUses: [] },
	]
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree', shortPaneProps)
	await ui.press({ key: 'open:agent-2' })
	const rowsOf = async () =>
		[
			...(await shown(ui)).matchAll(
				/"dimColor":false\},"children":\["([^"┃│]+)"\]/g
			),
		].map((match) => match[1])
	const newest = await rowsOf()
	expect(newest).toHaveLength(7)

	await $.ui.scroll(wheel('filetree', -1, { column: 5, row: 12 }, 22))
	await ui.redraw()
	const oneUp = await rowsOf()

	expect(oneUp).toHaveLength(7)
	expect(oneUp.slice(1)).toEqual(newest.slice(0, -1))
	expect(oneUp[0]).not.toEqual(newest[0])

	await $.ui.scroll(wheel('filetree', 1, { column: 5, row: 12 }, 22))
	await ui.redraw()
	expect(await rowsOf()).toEqual(newest)
	await ui.unmount()
})

test('should keep the colour of a diff line on its continuation rows', async ($, on) => {
	const transcript: SessionMessage[] = [
		{
			role: 'assistant',
			text: 'Patching the redirect',
			toolUses: [
				{
					tool_use_id: 'toolu-edit-1',
					tool: 'Edit',
					input: {
						file_path: 'src/login.ts',
						old_string:
							'const message = Sign in again to continue to the dashboard after your session expires',
						new_string:
							'const message = Welcome back, you can carry on to the dashboard where you left off',
					},
				},
			],
		},
	]
	const { clock } = world(on, { 'agent-2': transcript })
	await startSession($, clock)
	const ui = await mountPane($, 'filetree')
	await ui.press({ key: 'open:agent-2' })

	const drawn = await shown(ui)

	expect(drawn).toMatch(
		/"color":"#e06c75"[^}]*\},"children":\["  - const message = Sign in again/
	)
	expect(drawn).toMatch(
		/"color":"#e06c75"[^}]*\},"children":\["dashboard after your session expires"\]/
	)
	expect(drawn).toMatch(
		/"color":"#98c379"[^}]*\},"children":\["  \+ const message = Welcome back/
	)
	expect(drawn).toMatch(
		/"color":"#98c379"[^}]*\},"children":\["dashboard where you left off"\]/
	)
	await ui.unmount()
})
