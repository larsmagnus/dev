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

const paneProps = {
	title: 'Files',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 40 },
	view: {},
} satisfies RenderPropsOf['Pane']

function world(
	on: On,
	options: {
		backgroundTaskId?: string
		agents?: AgentInfo[]
		transcripts?: Record<string, SessionMessage[]>
	} = {}
) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	const transcriptReads: (string | undefined)[] = []
	mock.store(on)
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-4f2a9c' }))
	on('session.root', () => ({ value: '/work/punchdown' }))
	on('fs.read', (_$, e) => {
		throw new Error(`ENOENT: ${e.path}`)
	})
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('agent.list', () => ({ value: options.agents ?? [] }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('session.messages', (_$, e) => {
		transcriptReads.push(e.agentId)
		return {
			value: options.transcripts?.[e.agentId ?? ''] ?? [],
		}
	})
	on('tool.call', () => ({
		result: {
			stdout: '',
			stderr: '',
			...(options.backgroundTaskId && {
				backgroundTaskId: options.backgroundTaskId,
			}),
		},
	}))
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	// Stands in for the engine's own drawing of a message row.
	on('ui.render', { component: 'UserMessage' }, ($, e) => {
		const { Text } = $.ui.resolve(e)
		return <Text>{e.props.text}</Text>
	})
	on('agent.spawn', () => ({ model: 'sonnet', agentId: 'agent-1' }))
	return { clock, transcriptReads }
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
const notifyTaskEnded = async ($: Engine, id: string, status: string) => {
	const ui = await $.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'UserMessage',
		props: {
			text: `Background command finished (${status})`,
			origin: { kind: 'task-notification' },
			isExpanded: false,
			task: { id, status },
		},
	})
	await ui.unmount()
}
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

test('should list a backgrounded Bash command as a shell row titled by its description', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	const call = {
		tool: 'Bash',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	} satisfies ToolCallArgs
	await $.tool.call(call)
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).toContain('Agents (1 running, 1 total)')
	expect(drawn).toContain('pnpm dev --port 4000')
	expect((await ui.find({ key: 'open:bash-7c1e' }))?.text).toMatch(
		/^● Start the dev server\s+\(shell\)\s+running/
	)
	await ui.unmount()
})

test('should title a backgrounded Bash command by the command when it has no description', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({ tool: 'Bash', command: 'tail -f logs/app.log' })
	await clock.advance(1000)

	const ui = await mountPane($)

	expect((await ui.find({ key: 'open:bash-7c1e' }))?.text).toMatch(
		/^● tail -f logs\/app\.log\s+\(shell\)\s+running/
	)
	expect((await ui.find({ key: 'bash-7c1e' }))?.children).toHaveLength(1)
	await ui.unmount()
})

test('should not add a row for a foreground Bash command', async ($, on) => {
	const { clock } = world(on)
	await startSession($)
	await $.tool.call({
		tool: 'Bash',
		command: 'pnpm test',
		description: 'Run the unit tests',
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).not.toContain('Agents (')
	expect(drawn).not.toContain('(shell)')
	await ui.unmount()
})

test('should end a shell row once its task notification arrives', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({
		tool: 'Bash',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	})
	await clock.advance(1000)

	await notifyTaskEnded($, 'bash-7c1e', 'completed')
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).toContain('Agents (0 running, 1 total)')
	expect(drawn).toContain('completed')
	await ui.unmount()
})

for (const status of ['failed', 'killed']) {
	test(`should keep a shell ending as ${status} when the notification reported it`, async ($, on) => {
		const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
		await startSession($)
		await $.tool.call({
			tool: 'Bash',
			command: 'pnpm dev --port 4000',
			description: 'Start the dev server',
		})
		await clock.advance(1000)
		await notifyTaskEnded($, 'bash-7c1e', status)
		await clock.advance(1000)

		const ui = await mountPane($)
		const drawn = await shown(ui)

		expect(drawn).toContain('Agents (0 running, 1 total)')
		expect(drawn).toContain(status)
		await ui.unmount()
	})
}

test('should show a shell as completed when the notification uses another status word', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({
		tool: 'Bash',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	})
	await clock.advance(1000)

	await notifyTaskEnded($, 'bash-7c1e', 'exited')
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).toContain('Agents (0 running, 1 total)')
	expect(drawn).toContain('completed')
	expect(drawn).not.toContain('exited')
	await ui.unmount()
})

test('should show status, start, command and id for a shell without reading a transcript', async ($, on) => {
	const { clock, transcriptReads } = world(on, {
		backgroundTaskId: 'bash-7c1e',
	})
	await startSession($)
	await $.tool.call({
		tool: 'Bash',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	})
	await clock.advance(1000)
	const ui = await mountPane($)

	await ui.press({ key: 'open:bash-7c1e' })
	const drawn = await shown(ui)

	expect(drawn).toContain('Status  running for')
	expect(drawn).toContain('Started ')
	expect(drawn).toContain('Command pnpm dev --port 4000')
	expect(drawn).toContain('Id      bash-7c1e')
	expect(drawn).not.toContain('Task    ')
	expect(transcriptReads).toEqual([])
	await ui.unmount()
})

test('should show status, start, task prompt and id above an agent transcript', async ($, on) => {
	const agents: AgentInfo[] = [
		{
			id: 'agent-1',
			type: 'Explore',
			description: 'Find auth callers',
			status: 'running',
		},
	]
	const transcript: SessionMessage[] = [
		{ role: 'assistant', text: 'Checking the login flow', toolUses: [] },
	]
	const { clock, transcriptReads } = world(on, {
		agents,
		transcripts: { 'agent-1': transcript },
	})
	await startSession($)
	await $.agent.spawn({
		tool_use_id: 'toolu-spawn-1',
		prompt: 'Find every caller of signIn\nand list the files.',
		description: 'Find auth callers',
		subagentType: 'Explore',
		provider: { plugin: 'agent-dock', tier: 'user' },
		parentModel: 'sonnet',
		background: false,
		fork: false,
	})
	await clock.advance(1000)
	const ui = await mountPane($)

	await ui.press({ key: 'open:agent-1' })
	const drawn = await shown(ui)

	expect(drawn).toContain('Status  running for')
	expect(drawn).toContain(
		'Task    Find every caller of signIn and list the files.'
	)
	expect(drawn).toContain('Id      agent-1')
	expect(drawn).not.toContain('Command ')
	expect(drawn).toContain('Checking the login flow')
	expect(transcriptReads).toContain('agent-1')
	await ui.unmount()
})

const longCommand =
	"cat > /tmp/deploy.sh <<'EOF'\n#!/bin/sh\nset -e\npnpm build && pnpm test && rsync -az dist/ deploy@example.com:/srv/app\nEOF"

test('should clip a long command title to one line of 60 characters ending in an ellipsis', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({ tool: 'Bash', command: longCommand })
	await clock.advance(1000)

	const ui = await mountPane($)
	const row = await ui.find({ key: 'open:bash-7c1e' })

	const title = row?.text.match(/^● (.*?)\s+\(shell\)/)?.[1] ?? ''
	expect(title).toHaveLength(60)
	expect(title.endsWith('…')).toBe(true)
	expect(title).not.toContain('\n')
	expect((await ui.find({ key: 'bash-7c1e' }))?.children).toHaveLength(1)
	await ui.unmount()
})

test('should show the full command in the expanded view of a clipped shell', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({ tool: 'Bash', command: longCommand })
	await clock.advance(1000)
	const ui = await mountPane($)

	await ui.press({ key: 'open:bash-7c1e' })
	const drawn = await shown(ui)

	expect(drawn).toContain('build && pnpm test && rsync -az dist/')
	expect(drawn).toContain('deploy@example.com:/srv/app')
	await ui.unmount()
})

test('should leave a short command title untouched', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({ tool: 'Bash', command: 'tail -f logs/app.log' })
	await clock.advance(1000)

	const ui = await mountPane($)

	const text = (await ui.find({ key: 'open:bash-7c1e' }))?.text
	expect(text).toMatch(/^● tail -f logs\/app\.log\s+\(shell\)/)
	expect(text).not.toContain('…')
	await ui.unmount()
})

test('should use a short Bash description as the title without clipping', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({
		tool: 'Bash',
		command: longCommand,
		description: 'Deploy the production build',
	})
	await clock.advance(1000)

	const ui = await mountPane($)

	const text = (await ui.find({ key: 'open:bash-7c1e' }))?.text
	expect(text).toMatch(/^● Deploy the production build\s+\(shell\)/)
	expect(text).not.toContain('…')
	await ui.unmount()
})

for (const status of ['completed', 'failed'] as const) {
	test(`should kill a subagent's shell when its owner ${status}`, async ($, on) => {
		const owner: AgentInfo = {
			id: 'agent-1',
			type: 'Explore',
			description: 'Watch the build',
			status: 'running',
		}
		const agents = [owner]
		const { clock } = world(on, { agents, backgroundTaskId: 'bash-7c1e' })
		await startSession($)
		const call = {
			tool: 'Bash',
			agentId: 'agent-1',
			command: 'pnpm dev --port 4000',
			description: 'Start the dev server',
		} satisfies ToolCallArgs & AgentLoop
		await $.tool.call(call)
		await clock.advance(1000)

		owner.status = status
		await clock.advance(1000)

		const ui = await mountPane($)
		const text = (await ui.find({ key: 'open:bash-7c1e' }))?.text
		expect(text).toMatch(/Start the dev server\s+\(shell\)\s+killed/)
		await ui.unmount()
	})
}

test("should keep a subagent's shell running while its owner runs", async ($, on) => {
	const owner: AgentInfo = {
		id: 'agent-1',
		type: 'Explore',
		description: 'Watch the build',
		status: 'running',
	}
	const agents = [owner]
	const { clock } = world(on, { agents, backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	const call = {
		tool: 'Bash',
		agentId: 'agent-1',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	} satisfies ToolCallArgs & AgentLoop
	await $.tool.call(call)
	await clock.advance(3000)

	const ui = await mountPane($)
	const text = (await ui.find({ key: 'open:bash-7c1e' }))?.text
	expect(text).toMatch(/Start the dev server\s+\(shell\)\s+running/)
	await ui.unmount()
})

test('should keep a main-loop shell running after unrelated agents finish', async ($, on) => {
	const owner: AgentInfo = {
		id: 'agent-1',
		type: 'Explore',
		description: 'Find auth callers',
		status: 'running',
	}
	const agents = [owner]
	const { clock } = world(on, { agents, backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({
		tool: 'Bash',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	})
	await clock.advance(1000)

	owner.status = 'completed'
	await clock.advance(2000)

	const ui = await mountPane($)
	const text = (await ui.find({ key: 'open:bash-7c1e' }))?.text
	expect(text).toMatch(/Start the dev server\s+\(shell\)\s+running/)
	await ui.unmount()
})

test("should keep the reported status of a subagent's shell already ended by notification", async ($, on) => {
	const owner: AgentInfo = {
		id: 'agent-1',
		type: 'Explore',
		description: 'Watch the build',
		status: 'running',
	}
	const agents = [owner]
	const { clock } = world(on, { agents, backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	const call = {
		tool: 'Bash',
		agentId: 'agent-1',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	} satisfies ToolCallArgs & AgentLoop
	await $.tool.call(call)
	await clock.advance(1000)
	await notifyTaskEnded($, 'bash-7c1e', 'completed')
	await clock.advance(1000)

	owner.status = 'failed'
	await clock.advance(2000)

	const ui = await mountPane($)
	const text = (await ui.find({ key: 'open:bash-7c1e' }))?.text
	expect(text).toMatch(/Start the dev server\s+\(shell\)\s+completed/)
	await ui.unmount()
})
