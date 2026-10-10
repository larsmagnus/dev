import type { AgentInfo, On, RenderPropsOf } from 'claude-code'
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

function world(on: On, agents: AgentInfo[]) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	mock.store(on)
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('agent.list', () => ({ value: agents }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	return clock
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
const mountHost = ($: Engine) =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'filetree',
		props: paneProps,
	})
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

test('should show the newest agent first', async ($, on) => {
	const agents: AgentInfo[] = [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'running',
		},
	]
	const clock = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	agents.push({
		id: 'agent-2',
		type: 'Plan',
		description: 'Outline the migration',
		status: 'running',
	})
	await clock.advance(1000)
	agents.push({
		id: 'agent-3',
		type: 'general-purpose',
		description: 'Run the test suite',
		status: 'running',
	})
	await clock.advance(1000)

	const ui = await mountHost($)
	const drawn = await shown(ui)

	expect(drawn.indexOf('Run the test suite')).toBeGreaterThan(-1)
	expect(drawn.indexOf('Run the test suite')).toBeLessThan(
		drawn.indexOf('Outline the migration')
	)
	expect(drawn.indexOf('Outline the migration')).toBeLessThan(
		drawn.indexOf('Find auth callers')
	)
	await ui.unmount()
})

test('should move a finished agent that runs again to the top and restart its elapsed time', async ($, on) => {
	const resumed: AgentInfo = {
		id: 'agent-1',
		type: 'Explore',
		description: 'Find auth callers',
		status: 'running',
	}
	const agents: AgentInfo[] = [resumed]
	const clock = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	agents.push({
		id: 'agent-2',
		type: 'Plan',
		description: 'Outline the migration',
		status: 'running',
	})
	await clock.advance(1000)
	agents[0] = { ...resumed, status: 'completed' }
	await clock.advance(1000)
	await clock.advance(1000)
	await clock.advance(1000)
	await clock.advance(1000)

	const ui = await mountHost($)
	const finished = await shown(ui)
	expect(finished.indexOf('Outline the migration')).toBeLessThan(
		finished.indexOf('Find auth callers')
	)
	expect((await ui.find({ key: 'open:agent-1' }))?.text).toContain(
		'completed (2s)'
	)

	agents[0] = { ...resumed, status: 'running' }
	await clock.advance(1000)
	await clock.advance(1000)
	const restarted = await shown(ui)

	expect(restarted.indexOf('Find auth callers')).toBeLessThan(
		restarted.indexOf('Outline the migration')
	)
	const header = (await ui.find({ key: 'open:agent-1' }))?.text
	expect(header).toContain('running')
	expect(header).toContain('1s')
	expect(header).not.toContain('completed (2s)')
	await ui.unmount()
})

test('should put the status right after the type in the row header', async ($, on) => {
	const agents: AgentInfo[] = [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'running',
		},
	]
	const clock = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	await clock.advance(1000)
	await clock.advance(1000)

	const ui = await mountHost($)
	const header = (await ui.find({ key: 'open:agent-1' }))?.text

	expect(header).toMatch(/Explore\s+running\s+\(2s\)\s+Find auth callers/)
	await ui.unmount()
})

test('should draw the divider in the suggestion colour when hovered and dim at rest', async ($, on) => {
	const clock = world(on, [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'running',
		},
	])
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	const atRest = JSON.stringify(await ui.drawn({ in: 'divider' }))
	expect(atRest).toContain('dimColor')
	expect(atRest).not.toContain('suggestion')

	await ui.pointer({ type: 'move', x: 3, y: 0, in: 'divider' })
	const hovered = JSON.stringify(await ui.drawn({ in: 'divider' }))

	expect(hovered).toContain('"color":"suggestion"')
	await ui.unmount()
})
