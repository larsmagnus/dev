import type { AgentInfo, On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

const FILETREE_TEXT = 'README.md'
const NOTES_TEXT = 'Meeting notes.md'
const paneProps = {
	title: 'Pane',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

function world(on: On, agents: AgentInfo[]) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	const opened: string[] = []
	mock.store(on)
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('agent.list', () => ({ value: agents }))
	on('ui.open', (_$, e) => {
		opened.push(e.id)
		return { value: { isPlaced: true } }
	})
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>{FILETREE_TEXT}</Text>
			</Box>
		)
	})
	on('ui.render', { component: 'Pane', requestId: 'notes' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>{NOTES_TEXT}</Text>
			</Box>
		)
	})
	return { clock, opened }
}

const runningAgent = (): AgentInfo => ({
	id: 'agent-1',
	type: 'Explore',
	description: 'Find auth callers',
	status: 'running',
})
const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
const mountPane = ($: Engine, requestId: string) =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId,
		props: paneProps,
	})
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

test('should open the agents pane once after the grace period when no host pane draws', async ($, on) => {
	const { clock, opened } = world(on, [runningAgent()])
	await startSession($)

	await clock.advance(1000)
	await clock.advance(1000)
	expect(opened).toEqual([])

	await clock.advance(1000)
	expect(opened).toEqual(['agents'])

	await clock.advance(1000)
	await clock.advance(1000)
	expect(opened).toEqual(['agents'])
})

test('should never open the agents pane when the host pane has drawn', async ($, on) => {
	const { clock, opened } = world(on, [runningAgent()])
	await startSession($)

	const host = await mountPane($, 'filetree')
	await clock.advance(1000)
	await clock.advance(1000)
	await clock.advance(1000)
	await clock.advance(1000)
	await clock.advance(1000)

	expect(opened).toEqual([])
	await host.unmount()
})

test(
	'should open the agents pane without the grace period and leave filetree unwrapped when hostPane is empty',
	{ options: { hostPane: '' } },
	async ($, on) => {
		const { clock, opened } = world(on, [runningAgent()])
		await startSession($)

		await clock.advance(1000)
		expect(opened).toEqual(['agents'])

		const ui = await mountPane($, 'filetree')
		const drawn = await shown(ui)
		expect(drawn).toContain(FILETREE_TEXT)
		expect(drawn).not.toContain('Agents (')
		await ui.unmount()
	}
)

test(
	'should split the notes pane and not the filetree pane when hostPane is notes',
	{ options: { hostPane: 'notes' } },
	async ($, on) => {
		const { clock } = world(on, [runningAgent()])
		await startSession($)
		await clock.advance(1000)

		const notes = await mountPane($, 'notes')
		const notesDrawn = await shown(notes)
		expect(notesDrawn).toContain(NOTES_TEXT)
		expect(notesDrawn).toContain('Agents (1 running, 1 total)')
		await notes.unmount()

		const filetree = await mountPane($, 'filetree')
		const filetreeDrawn = await shown(filetree)
		expect(filetreeDrawn).toContain(FILETREE_TEXT)
		expect(filetreeDrawn).not.toContain('Agents (')
		await filetree.unmount()
	}
)

test('should open the agents pane on /agents even with no agents', async ($, on) => {
	const { clock, opened } = world(on, [])
	await startSession($)
	await clock.settle()

	const result = await $.command.run({
		command: 'agents',
		args: '',
		origin: { kind: 'composer' },
		presentation: { isFullscreen: false, columns: 120 },
	})

	expect(opened).toEqual(['agents'])
	expect(result).toMatchObject({ text: 'Agents pane opened.' })
})

test('should draw the agent rows in the agents pane with no host tree above them', async ($, on) => {
	const { clock } = world(on, [runningAgent()])
	await startSession($)
	await clock.advance(1000)

	const ui = await mountPane($, 'agents')
	const drawn = await shown(ui)

	expect(drawn).toContain('Agents (1 running, 1 total)')
	expect(drawn).toContain('Explore')
	expect(drawn).toContain('Find auth callers')
	expect(drawn).not.toContain(FILETREE_TEXT)
	await ui.unmount()
})
