import type { AgentInfo, On, RenderPropsOf, ToolCallArgs } from 'claude-code'
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

const arrivalColor = '#61afef'

function world(
	on: On,
	options: {
		files?: Record<string, string>
		agents?: AgentInfo[]
		usage?: {
			model: string
			input_tokens: number
			output_tokens: number
			cache_read_input_tokens: number
			cache_creation_input_tokens: number
		}
		backgroundTaskId?: string
	} = {}
) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	const agents = options.agents ?? []
	mock.store(on)
	mock.env(on, { HOME: '/Users/ada' })
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-4f2a9c' }))
	on('session.root', () => ({ value: '/work/punchdown' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('fs.read', (_$, e) => {
		const text = options.files?.[e.path]
		if (text === undefined) throw new Error(`ENOENT: ${e.path}`)

		return { value: text }
	})
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
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('session.messages', () => ({ value: [] }))
	on('tool.call', () => ({
		result: {
			stdout: '',
			stderr: '',
			...(options.backgroundTaskId && {
				backgroundTaskId: options.backgroundTaskId,
			}),
		},
	}))
	on('turn.step', async function* (_$, e) {
		yield {
			kind: 'stop',
			stopReason: 'end_turn',
			usage: options.usage ?? null,
		}
		return {
			turnId: e.turnId,
			index: e.index,
			answer: '',
			toolUses: [],
			stopReason: 'end_turn',
			usage: options.usage ?? null,
		}
	})
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	return { clock, agents }
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
const spawn = ($: Engine, subagentType: string, description: string) =>
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
const mountPane = ($: Engine) =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'filetree',
		props: paneProps,
	})

const namedColors = {
	red: '#e06c75',
	blue: '#61afef',
	green: '#98c379',
	yellow: '#e5c07b',
	purple: '#c678dd',
	orange: '#d19a66',
	pink: '#f78fb3',
	cyan: '#56b6c2',
} as const

for (const [name, hex] of Object.entries(namedColors)) {
	test(`should colour an agent ${name} when its file names ${name}`, async ($, on) => {
		const type = `${name}-reviewer`
		const { clock, agents } = world(on, {
			files: {
				[`/work/punchdown/.claude/agents/${type}.md`]: `---\nname: ${type}\ncolor: ${name}\n---\nReview the diff.`,
			},
		})
		await startSession($)
		await spawn($, type, 'Review the diff')
		agents.forEach((agent) => {
			agent.status = 'completed'
		})
		await clock.advance(1000)

		const ui = await mountPane($)
		const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
		const drawnName = Array.from(`● ${type}`).filter((char) => char !== ' ')
		expect(chars.map((char) => char.props.color)).toEqual(
			drawnName.map(() => hex)
		)
		await ui.unmount()
	})
}

test('should colour an agent by the hex value its file names', async ($, on) => {
	const { clock, agents } = world(on, {
		files: {
			'/work/punchdown/.claude/agents/release-notes.md':
				'---\nname: release-notes\ncolor: "#ff8800"\n---\nDraft the notes.',
		},
	})
	await startSession($)
	await spawn($, 'release-notes', 'Draft the notes')
	agents.forEach((agent) => {
		agent.status = 'completed'
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
	const name = Array.from(`● release-notes`).filter((char) => char !== ' ')
	expect(chars.map((char) => char.props.color)).toEqual(
		name.map(() => '#ff8800')
	)
	await ui.unmount()
})

test('should read the agent file from the home folder when the project has none', async ($, on) => {
	const { clock, agents } = world(on, {
		files: {
			'/Users/ada/.claude/agents/home-planner.md':
				'---\nname: home-planner\ncolor: pink\n---\nPlan the work.',
		},
	})
	await startSession($)
	await spawn($, 'home-planner', 'Plan the work')
	agents.forEach((agent) => {
		agent.status = 'completed'
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
	const name = Array.from(`● home-planner`).filter((char) => char !== ' ')
	expect(chars.map((char) => char.props.color)).toEqual(
		name.map(() => namedColors.pink)
	)
	await ui.unmount()
})

test('should prefer the project agent file over the home one', async ($, on) => {
	const { clock, agents } = world(on, {
		files: {
			'/work/punchdown/.claude/agents/shared-auditor.md':
				'---\ncolor: green\n---\nAudit.',
			'/Users/ada/.claude/agents/shared-auditor.md':
				'---\ncolor: red\n---\nAudit.',
		},
	})
	await startSession($)
	await spawn($, 'shared-auditor', 'Audit the deps')
	agents.forEach((agent) => {
		agent.status = 'completed'
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
	const name = Array.from(`● shared-auditor`).filter((char) => char !== ' ')
	expect(chars.map((char) => char.props.color)).toEqual(
		name.map(() => namedColors.green)
	)
	await ui.unmount()
})

test('should fall back to the arrival colour when no agent file exists', async ($, on) => {
	const { clock, agents } = world(on)
	await startSession($)
	await spawn($, 'ghost-writer', 'Write the changelog')
	agents.forEach((agent) => {
		agent.status = 'completed'
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
	const name = Array.from(`● ghost-writer`).filter((char) => char !== ' ')
	expect(chars.map((char) => char.props.color)).toEqual(
		name.map(() => arrivalColor)
	)
	await ui.unmount()
})

test('should fall back to the arrival colour when the agent file names no colour', async ($, on) => {
	const { clock, agents } = world(on, {
		files: {
			'/work/punchdown/.claude/agents/plain-helper.md':
				'---\nname: plain-helper\ndescription: Helps.\n---\nHelp.',
		},
	})
	await startSession($)
	await spawn($, 'plain-helper', 'Help out')
	agents.forEach((agent) => {
		agent.status = 'completed'
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
	const name = Array.from(`● plain-helper`).filter((char) => char !== ' ')
	expect(chars.map((char) => char.props.color)).toEqual(
		name.map(() => arrivalColor)
	)
	await ui.unmount()
})

test('should fall back to the arrival colour when the agent file names an unknown colour', async ($, on) => {
	const { clock, agents } = world(on, {
		files: {
			'/work/punchdown/.claude/agents/odd-helper.md':
				'---\ncolor: chartreuse\n---\nHelp.',
		},
	})
	await startSession($)
	await spawn($, 'odd-helper', 'Help out')
	agents.forEach((agent) => {
		agent.status = 'completed'
	})
	await clock.advance(1000)

	const ui = await mountPane($)
	const chars = await ui.findAll({ type: 'Text', text: /^\S$/ })
	const name = Array.from(`● odd-helper`).filter((char) => char !== ' ')
	expect(chars.map((char) => char.props.color)).toEqual(
		name.map(() => arrivalColor)
	)
	await ui.unmount()
})

const statusColors: [AgentInfo['status'], string][] = [
	['running', '#61afef'],
	['completed', '#98c379'],
	['failed', '#e06c75'],
	['killed', '#d19a66'],
	['waiting', '#e5c07b'],
	['idle', '#e5c07b'],
]

for (const [status, hex] of statusColors) {
	test(`should draw the ${status} status word in ${hex}`, async ($, on) => {
		const { clock } = world(on, {
			agents: [
				{
					id: 'agent-1',
					type: 'Explore',
					description: 'Find auth callers',
					status,
				},
			],
		})
		await startSession($)
		await clock.advance(1000)

		const ui = await mountPane($)
		const word = await ui.find({
			type: 'Text',
			text: new RegExp(`^\\s*${status}$`),
		})

		expect(word?.props.color).toBe(hex)
		await ui.unmount()
	})
}

test('should title a backgrounded Bash command `shell` and an agent by its type', async ($, on) => {
	const { clock } = world(on, {
		backgroundTaskId: 'bash-7c1e',
		agents: [
			{
				id: 'agent-1',
				type: 'Explore',
				description: 'Find auth callers',
				status: 'running',
			},
		],
	})
	await startSession($)
	const call = {
		tool: 'Bash',
		command: 'pnpm dev --port 4000',
		description: 'Start the dev server',
	} satisfies ToolCallArgs
	await $.tool.call(call)
	await clock.advance(1000)

	const ui = await mountPane($)
	const shell = await ui.find({ key: 'open:bash-7c1e' })
	const agent = await ui.find({ key: 'open:agent-1' })

	expect(shell?.text).toMatch(/^● shell\s+running/)
	expect(shell?.text).not.toContain('(shell)')
	expect(agent?.text).toMatch(/^● Explore\s+running/)
	await ui.unmount()
})

test('should draw the description on its own line below the title and above the activity lines', async ($, on) => {
	const { clock } = world(on)
	await startSession($)
	const { agentId = '' } = await spawn($, 'Explore', 'Find auth callers')
	const read = {
		tool: 'Read',
		agentId,
		file_path: 'src/login.ts',
	} satisfies ToolCallArgs & { agentId: string }
	await $.tool.call(read)
	await clock.advance(1000)

	const ui = await mountPane($)
	const row = await ui.find({ key: 'agent-1' })
	const lines = await ui.findAll({ type: 'Text' })
	const description = lines.find((line) =>
		line.text.includes('Find auth callers')
	)
	const activity = lines.find((line) =>
		line.text.includes('⏺ Read(src/login.ts)')
	)

	expect(row?.children).toHaveLength(3)
	expect(row?.children[0]).toMatchObject({
		type: 'Box',
		props: { flexDirection: 'row', height: 1, overflow: 'hidden' },
		children: [{ type: 'Button' }],
	})
	expect(row?.children[1]).toMatchObject({ type: 'Text' })
	expect(JSON.stringify(row?.children[1])).toContain('Find auth callers')
	expect(JSON.stringify(row?.children[2])).toContain('⏺ Read(src/login.ts)')
	expect(description?.props.dimColor).toBeUndefined()
	expect(activity?.props.dimColor).toBe(true)
	await ui.unmount()
})

test('should draw only the command line below the title for a shell that has no Bash description', async ($, on) => {
	const { clock } = world(on, { backgroundTaskId: 'bash-7c1e' })
	await startSession($)
	await $.tool.call({ tool: 'Bash', command: 'tail -f logs/app.log' })
	await clock.advance(1000)

	const ui = await mountPane($)
	const row = await ui.find({ key: 'bash-7c1e' })

	expect(row?.children).toHaveLength(2)
	expect(row?.children[0]).toMatchObject({
		type: 'Box',
		props: { flexDirection: 'row', height: 1, overflow: 'hidden' },
		children: [{ type: 'Button' }],
	})
	expect(JSON.stringify(row?.children[1])).toContain(
		'⏺ Bash(tail -f logs/app.log)'
	)
	await ui.unmount()
})

test('should show the context size once a stop chunk reported usage', async ($, on) => {
	const { clock } = world(on, {
		usage: {
			model: 'claude-sonnet-4-5',
			input_tokens: 30_000,
			output_tokens: 800,
			cache_read_input_tokens: 90_000,
			cache_creation_input_tokens: 30_000,
		},
	})
	await startSession($)
	const { agentId = '' } = await spawn($, 'Explore', 'Find auth callers')
	await clock.advance(1000)
	const ui = await mountPane($)
	expect((await ui.find({ key: 'open:agent-1' }))?.text).not.toContain('ctx')

	const chunks = $.turn.step({
		turnId: 'turn-1',
		index: 0,
		model: 'claude-sonnet-4-5',
		messageCount: 1,
		agentId,
	})
	for await (const chunk of chunks) expect(chunk.kind).toBeDefined()
	await clock.advance(1000)

	expect((await ui.find({ key: 'open:agent-1' }))?.text).toContain(
		'(2s) · ctx 150k'
	)
	await ui.unmount()
})

test('should show the size of the latest request rather than a running total', async ($, on) => {
	const usage = {
		model: 'claude-sonnet-4-5',
		input_tokens: 60_000,
		output_tokens: 500,
		cache_read_input_tokens: 80_000,
		cache_creation_input_tokens: 10_000,
	}
	const { clock } = world(on, { usage })
	await startSession($)
	const { agentId = '' } = await spawn($, 'Explore', 'Find auth callers')
	await clock.advance(1000)
	const ui = await mountPane($)
	const step = async (index: number) => {
		const chunks = $.turn.step({
			turnId: 'turn-1',
			index,
			model: 'claude-sonnet-4-5',
			messageCount: 1,
			agentId,
		})
		for await (const chunk of chunks) expect(chunk.kind).toBeDefined()
		await clock.advance(1000)
	}

	await step(0)
	expect((await ui.find({ key: 'open:agent-1' }))?.text).toContain('ctx 150k')

	usage.input_tokens = 2_000
	usage.cache_read_input_tokens = 40_000
	usage.cache_creation_input_tokens = 0
	await step(1)

	expect((await ui.find({ key: 'open:agent-1' }))?.text).toContain('ctx 42k')
	await ui.unmount()
})

test('should show no context size for a stop chunk without usage', async ($, on) => {
	const { clock } = world(on)
	await startSession($)
	const { agentId = '' } = await spawn($, 'Explore', 'Find auth callers')
	const ui = await mountPane($)

	const chunks = $.turn.step({
		turnId: 'turn-1',
		index: 0,
		model: 'sonnet',
		messageCount: 1,
		agentId,
	})
	for await (const chunk of chunks) expect(chunk.kind).toBeDefined()
	await clock.advance(1000)

	const title = await ui.find({ key: 'open:agent-1' })
	expect(title?.text).toContain('(1s)')
	expect(title?.text).not.toContain('ctx')
	await ui.unmount()
})

test('should draw the agent title as a focusable button keyed by the agent', async ($, on) => {
	const { clock } = world(on)
	await startSession($)
	await spawn($, 'Explore', 'Find auth callers')
	await clock.advance(1000)

	const ui = await mountPane($)
	const title = await ui.find({ key: 'open:agent-1' })

	expect(title?.type).toBe('Button')
	expect(title?.text).toMatch(/^● Explore\s+running\s+\(1s\)$/)
	await ui.unmount()
})

test('should open the agent when its its title button is pressed', async ($, on) => {
	const { clock } = world(on)
	await startSession($)
	await spawn($, 'Explore', 'Find auth callers')
	await clock.advance(1000)
	const ui = await mountPane($)
	expect(await ui.find({ key: 'back' })).toBeUndefined()

	await ui.press({ key: 'open:agent-1' })

	expect(await ui.find({ key: 'back' })).toBeDefined()
	await ui.unmount()
})
