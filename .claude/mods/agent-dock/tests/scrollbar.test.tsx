import type {
	AgentInfo,
	On,
	RenderPropsOf,
	SessionMessage,
	UiScrollInput,
} from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const paneProps = {
	title: 'Files',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']
// A short body so a long transcript outruns the pane.
const shortPaneProps = {
	...paneProps,
	scroll: { offset: 0, bodyRows: 18 },
} satisfies RenderPropsOf['Pane']

const agentsOf = (
	count: number,
	status: AgentInfo['status'] = 'running'
): AgentInfo[] =>
	Array.from({ length: count }, (_, i) => ({
		id: `agent-${i + 1}`,
		type: 'Explore',
		description: `Audit package ${i + 1}`,
		status,
	}))

const transcriptOf = (count: number): SessionMessage[] =>
	Array.from({ length: count }, (_, i) => ({
		role: 'assistant',
		text: `Checked module ${i + 1}`,
		toolUses: [],
	}))

function world(
	on: On,
	agents: AgentInfo[],
	transcript: SessionMessage[] = transcriptOf(2)
) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	mock.store(on, { host: 'filetree' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-4f2a9c' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('agent.list', () => ({ value: agents }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('ui.scroll', () => ({}))
	on('session.messages', () => ({ value: transcript }))
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	return { clock }
}

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
const mountPane = ($: Engine, props: RenderPropsOf['Pane'] = paneProps) =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'filetree',
		props,
	})
const wheel = (by: number, row: number, bodyRows = 40): UiScrollInput => ({
	component: 'Pane',
	requestId: 'filetree',
	offset: 0,
	by,
	bodyRows,
	contentRows: bodyRows,
	origin: { kind: 'person' },
	pointer: { column: 5, row },
})

test('should reserve an empty scrollbar column when every agent fits the list', async ($, on) => {
	const { clock } = world(on, agentsOf(3))
	await startSession($, clock)

	const ui = await mountPane($)
	const track = await ui.findAll({ type: 'Text', text: /^[┃│]$/ })
	const boxes = await ui.findAll({ type: 'Box' })

	expect(track).toHaveLength(0)
	expect(
		boxes.filter((box) => box.props.width === 1 && box.props.flexShrink === 0)
	).toHaveLength(1)
	await ui.unmount()
})

test('should draw a scrollbar with a thumb when the agents outrun the list', async ($, on) => {
	const { clock } = world(on, agentsOf(12))
	await startSession($, clock)

	const ui = await mountPane($)
	const column = (await ui.findAll({ type: 'Text', text: /^[┃│]$/ }))
		.map((cell) => cell.text)
		.join('')

	expect(column).toMatch(/^┃+│+$/)
	await ui.unmount()
})

test('should draw the thumb at the top of the list at offset 0 and at the bottom once scrolled to the end', async ($, on) => {
	const { clock } = world(on, agentsOf(12))
	await startSession($, clock)
	const ui = await mountPane($)

	const atTop = (await ui.findAll({ type: 'Text', text: /^[┃│]$/ }))
		.map((cell) => cell.text)
		.join('')
	await $.ui.scroll(wheel(30, 25))
	await ui.redraw()
	const atEnd = (await ui.findAll({ type: 'Text', text: /^[┃│]$/ }))
		.map((cell) => cell.text)
		.join('')

	expect(atTop).toMatch(/^┃+│+$/)
	expect(atEnd).toMatch(/^│+┃+$/)
	expect(atEnd).toHaveLength(atTop.length)
	await ui.unmount()
})

test('should shrink the thumb as more agents are listed', async ($, on) => {
	const agents = agentsOf(12)
	const { clock } = world(on, agents)
	await startSession($, clock)
	const ui = await mountPane($)
	const few = (await ui.findAll({ type: 'Text', text: '┃' })).length

	agents.push(...agentsOf(48).slice(12))
	await clock.advance(1000)
	await ui.redraw()
	const many = (await ui.findAll({ type: 'Text', text: '┃' })).length

	expect(many).toBeGreaterThan(0)
	expect(many).toBeLessThan(few)
	await ui.unmount()
})

test('should keep the archive bar drawn under a long list', async ($, on) => {
	const agents = [
		...agentsOf(12),
		...agentsOf(3, 'completed').map((agent) => ({
			...agent,
			id: `${agent.id}-done`,
		})),
	]
	const { clock } = world(on, agents)
	await startSession($, clock)

	const ui = await mountPane($)

	expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
		'▸ Archived (0)'
	)
	expect((await ui.find({ key: 'archive:finished' }))?.text).toContain(
		'archive 3 finished'
	)
	expect(await ui.findAll({ type: 'Text', text: /^[┃│]$/ })).not.toHaveLength(0)
	await ui.unmount()
})

test('should not let the list squash agent entries or the archive bar', async ($, on) => {
	const agents = [
		...agentsOf(12),
		{ ...agentsOf(1)[0]!, id: 'agent-done', status: 'completed' as const },
	]
	const { clock } = world(on, agents)
	await startSession($, clock)

	const ui = await mountPane($)

	expect((await ui.find({ key: 'agent-1' }))?.props.flexShrink).toBe(0)
	expect((await ui.find({ key: 'agent-12' }))?.props.flexShrink).toBe(0)
	expect((await ui.find({ key: 'archive' }))?.props.flexShrink).toBe(0)
	await ui.unmount()
})

test('should reserve an empty scrollbar column beside a transcript that fits the pane', async ($, on) => {
	const { clock } = world(on, agentsOf(1), transcriptOf(2))
	await startSession($, clock)
	const ui = await mountPane($, shortPaneProps)

	await ui.press({ key: 'open:agent-1' })
	const track = await ui.findAll({ type: 'Text', text: /^[┃│]$/ })

	expect(track).toHaveLength(0)
	await ui.unmount()
})

test('should draw the transcript thumb at the bottom and move it toward the top as the wheel turns up', async ($, on) => {
	const { clock } = world(on, agentsOf(1), transcriptOf(40))
	await startSession($, clock)
	const ui = await mountPane($, shortPaneProps)
	await ui.press({ key: 'open:agent-1' })

	const newest = (await ui.findAll({ type: 'Text', text: /^[┃│]$/ }))
		.map((cell) => cell.text)
		.join('')
	await $.ui.scroll(wheel(-10, 12, 18))
	await ui.redraw()
	const scrolledUp = (await ui.findAll({ type: 'Text', text: /^[┃│]$/ }))
		.map((cell) => cell.text)
		.join('')
	await $.ui.scroll(wheel(-100, 12, 18))
	await ui.redraw()
	const atStart = (await ui.findAll({ type: 'Text', text: /^[┃│]$/ }))
		.map((cell) => cell.text)
		.join('')

	expect(newest).toMatch(/^│+┃+$/)
	expect(scrolledUp.indexOf('┃')).toBeLessThan(newest.indexOf('┃'))
	expect(scrolledUp).toMatch(/^│+┃+│+$/)
	expect(atStart).toMatch(/^┃+│+$/)
	await ui.unmount()
})

test('should shrink the transcript thumb as the transcript grows', async ($, on) => {
	const transcript = transcriptOf(12)
	const { clock } = world(on, agentsOf(1), transcript)
	await startSession($, clock)
	const ui = await mountPane($, shortPaneProps)
	await ui.press({ key: 'open:agent-1' })
	const short = (await ui.findAll({ type: 'Text', text: '┃' })).length

	transcript.push(...transcriptOf(120).slice(12))
	await clock.advance(1000)
	await ui.redraw()
	const long = (await ui.findAll({ type: 'Text', text: '┃' })).length

	expect(long).toBeGreaterThan(0)
	expect(long).toBeLessThan(short)
	await ui.unmount()
})
