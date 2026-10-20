import type { AgentInfo, On, RenderPropsOf } from 'claude-code'
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

function world(on: On, agents: AgentInfo[]) {
	const draws = { count: 0 }
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	mock.store(on, { host: 'filetree' })
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-4f2a9c' }))
	on('session.root', () => ({ value: '/work/punchdown' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('fs.read', (_$, e) => {
		throw new Error(`ENOENT: ${e.path}`)
	})
	on('agent.list', () => ({ value: agents }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('session.messages', () => ({ value: [] }))
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		draws.count += 1
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	return { clock, draws }
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
const mountPane = ($: Engine) =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'filetree',
		props: paneProps,
	})

test('should change the colour of the name characters of a running agent as the clock advances', async ($, on) => {
	const agents: AgentInfo[] = [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'running',
		},
	]
	const { clock } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountPane($)
	const frames = await Array.from({ length: 6 }).reduce<Promise<string[]>>(
		async (previous) => {
			const seen = await previous
			const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
			await clock.advance(150)
			return [...seen, chars.map((char) => String(char.props.color)).join(' ')]
		},
		Promise.resolve([])
	)

	expect(new Set(frames).size).toBe(frames.length)
	expect(new Set(frames[3]?.split(' ')).size).toBeGreaterThan(1)
	await ui.unmount()
})

test('should keep the name characters of a finished agent one steady colour', async ($, on) => {
	const agents: AgentInfo[] = [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'completed',
		},
	]
	const { clock } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountPane($)
	const frames = await Array.from({ length: 6 }).reduce<Promise<string[]>>(
		async (previous) => {
			const seen = await previous
			const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
			await clock.advance(150)
			return [...seen, chars.map((char) => String(char.props.color)).join(' ')]
		},
		Promise.resolve([])
	)

	expect(new Set(frames).size).toBe(1)
	expect(new Set(frames[0]?.split(' ')).size).toBe(1)
	await ui.unmount()
})

test('should stop shimmering once the running agent finishes', async ($, on) => {
	const agents: AgentInfo[] = [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'running',
		},
	]
	const { clock } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountPane($)

	agents[0] = { ...agents[0]!, status: 'completed' }
	await clock.advance(1000)
	const before = await ui.findAll({ type: 'Text', text: /^\S$/ })
	await clock.advance(450)
	const after = await ui.findAll({ type: 'Text', text: /^\S$/ })

	expect(after.map((char) => char.props.color)).toEqual(
		before.map((char) => char.props.color)
	)
	expect(new Set(after.map((char) => char.props.color)).size).toBe(1)
	await ui.unmount()
})

test(
	'should not redraw the pane on the shimmer clock while no agent runs',
	{ options: { autoArchiveMinutes: 0 } },
	async ($, on) => {
		const agents: AgentInfo[] = [
			{
				id: 'agent-1',
				type: 'Explore',
				description: 'Find auth callers',
				status: 'completed',
			},
		]
		const { clock, draws } = world(on, agents)
		await startSession($)
		await clock.advance(1000)
		const ui = await mountPane($)
		await clock.advance(3000)
		const settled = draws.count

		await clock.advance(10 * 150)

		expect(draws.count).toBe(settled)
		await ui.unmount()
	}
)

test('should redraw the pane on every shimmer step while an agent runs', async ($, on) => {
	const agents: AgentInfo[] = [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'running',
		},
	]
	const { clock, draws } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountPane($)
	const settled = draws.count

	await clock.advance(10 * 150)

	expect(draws.count).toBeGreaterThanOrEqual(settled + 10)
	await ui.unmount()
})
