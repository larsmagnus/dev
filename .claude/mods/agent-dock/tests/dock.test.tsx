import type {
	AgentInfo,
	AgentLoop,
	On,
	RenderPropsOf,
	SessionMessage,
	ToolCallArgs,
} from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

const FILETREE_TEXT = 'README.md'
const paneProps = {
	title: 'Files',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

declare module 'claude-code' {
	interface BuiltinToolInputs {
		Grep: { pattern: string }
	}
}

function world(
	on: On,
	agents: AgentInfo[],
	transcripts: Record<string, SessionMessage[]> = {}
) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	mock.store(on)
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('agent.spawn', (_$, e) => {
		const id = `agent-${agents.length + 1}`
		agents.push({
			id,
			type: e.subagentType,
			description: e.description,
			status: 'running',
		})
		return { model: 'sonnet', agentId: id }
	})
	on('agent.list', () => ({ value: agents }))
	on('session.messages', (_$, e) => ({
		value: transcripts[e.agentId ?? ''] ?? {
			deny: `unknown agent ${e.agentId}`,
		},
	}))
	on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
	on('turn.step', async function* (_$, e) {
		yield { kind: 'text', index: 0, text: 'Reading the ' }
		yield { kind: 'text', index: 0, text: 'login handler' }
		return {
			turnId: e.turnId,
			index: e.index,
			answer: 'Reading the login handler',
			toolUses: [],
			stopReason: 'end_turn',
			usage: null,
		}
	})
	// Stands in for the filetree plugin, which the dock wraps.
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>{FILETREE_TEXT}</Text>
			</Box>
		)
	})
	return clock
}

const spawn = ($: Engine, description: string, subagentType = 'Explore') =>
	$.agent.spawn({
		tool_use_id: 'toolu-spawn-1',
		prompt: 'Look around.',
		description,
		subagentType,
		provider: { plugin: 'agent-dock', tier: 'user' },
		parentModel: 'sonnet',
		background: false,
		fork: false,
	})
const streamStep = async ($: Engine, agentId: string) => {
	const chunks = $.turn.step({
		turnId: 'turn-1',
		index: 0,
		model: 'sonnet',
		messageCount: 1,
		agentId,
	})
	for await (const chunk of chunks) expect(chunk.kind).toBeDefined()
}
const mountPane = ($: Engine) =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'filetree',
		props: paneProps,
	})
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

test('should count finished agents in the total but not in the running count', async ($, on) => {
	const clock = world(on, [
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
			status: 'completed',
		},
	])
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).toContain('Agents (1 running, 2 total)')
	await ui.unmount()
})

test('should draw the filetree untouched when no agent exists', async ($, on) => {
	const clock = world(on, [])
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	await clock.settle()

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).toContain(FILETREE_TEXT)
	expect(drawn).not.toContain('Agents (')
	await ui.unmount()
})

test('should show type, description, status and elapsed time after an Agent spawn', async ($, on) => {
	const clock = world(on, [])
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	await spawn($, 'Find auth callers')
	await clock.advance(1000)
	await clock.advance(1000)
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).toContain(FILETREE_TEXT)
	expect(drawn).toContain('Agents (1 running, 1 total)')
	expect(drawn).toContain('Explore')
	expect(drawn).toContain('Find auth callers')
	expect(drawn).toContain('running')
	expect(drawn).toContain('running')
	expect(drawn).toContain('3s')
	await ui.unmount()
})

test('should keep only the two newest tool calls as activity lines', async ($, on) => {
	const clock = world(on, [])
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	const { agentId = '' } = await spawn($, 'Find auth callers')
	const read = {
		tool: 'Read',
		agentId,
		file_path: 'src/auth.ts',
	} satisfies ToolCallArgs & AgentLoop
	const grep = {
		tool: 'Grep',
		agentId,
		pattern: 'signIn',
	} satisfies ToolCallArgs & AgentLoop
	const bash = {
		tool: 'Bash',
		agentId,
		command: 'pnpm test',
	} satisfies ToolCallArgs & AgentLoop
	await $.tool.call(read)
	await $.tool.call(grep)
	await $.tool.call(bash)
	await clock.settle()

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).not.toContain('⏺ Read(src/auth.ts)')
	expect(drawn).toContain('⏺ Grep(signIn)')
	expect(drawn).toContain('⏺ Bash(pnpm test)')
	await ui.unmount()
})

test('should open the transcript on pressing a row and return to the list on back', async ($, on) => {
	const transcript: SessionMessage[] = [
		{
			role: 'assistant',
			text: 'Checking the login flow',
			toolUses: [
				{
					tool_use_id: 'toolu-read-1',
					tool: 'Read',
					input: { file_path: 'src/login.ts' },
				},
			],
		},
	]
	const clock = world(on, [], { 'agent-1': transcript })
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	await spawn($, 'Find auth callers')
	await clock.settle()

	const ui = await mountPane($)
	expect(await shown(ui)).not.toContain('Checking the login flow')

	await ui.press({ key: 'open:agent-1' })
	const opened = await shown(ui)
	expect(opened).toContain('Checking the login flow')
	expect(opened).toContain('⏺ Read(src/login.ts)')
	expect(opened).toContain(FILETREE_TEXT)

	await ui.press({ key: 'back' })
	const back = await shown(ui)
	expect(back).not.toContain('Checking the login flow')
	expect(back).toContain('Find auth callers')
	await ui.unmount()
})

test('should show streamed text as the newest activity line once the next tick flushes it', async ($, on) => {
	const clock = world(on, [])
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	const { agentId = '' } = await spawn($, 'Find auth callers')
	const read = {
		tool: 'Read',
		agentId,
		file_path: 'src/login.ts',
	} satisfies ToolCallArgs & AgentLoop
	await $.tool.call(read)
	await streamStep($, agentId)

	const ui = await mountPane($)
	expect(await shown(ui)).not.toContain('Reading the login handler')

	await clock.advance(1000)
	const drawn = await shown(ui)

	expect(drawn).toContain('⏺ Read(src/login.ts)')
	expect(drawn).toContain('Reading the login handler')
	await ui.unmount()
})

test('should draw the agents split on the desktop surface', async ($, on) => {
	const clock = world(on, [])
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'desktop',
		isInteractive: true,
	})
	await spawn($, 'Find auth callers')
	await clock.settle()

	const ui = await $.ui.mount({
		plugin: 'agent-dock',
		surface: 'desktop',
		component: 'Pane',
		requestId: 'filetree',
		props: paneProps,
	})
	const drawn = await shown(ui)

	expect(drawn).toContain(FILETREE_TEXT)
	expect(drawn).toContain('Agents (1 running, 1 total)')
	expect(drawn).toContain('Find auth callers')
	await ui.unmount()
})

for (const surface of ['mobile', 'vscode'] as const) {
	test(`should draw nothing extra on the ${surface} surface`, async ($, on) => {
		const clock = world(on, [])
		await $.session.start({
			cwd: '/work/punchdown',
			surface,
			isInteractive: true,
		})
		await spawn($, 'Find auth callers')
		await clock.settle()

		const ui = await $.ui.mount({
			plugin: 'agent-dock',
			surface,
			component: 'Pane',
			requestId: 'filetree',
			props: paneProps,
		})
		const drawn = await shown(ui)

		expect(drawn).toContain(FILETREE_TEXT)
		expect(drawn).not.toContain('Agents (')
		await ui.unmount()
	})
}
