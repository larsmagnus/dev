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

function world(
	on: On,
	options: { sessionId: string; stored?: unknown; agents?: AgentInfo[] }
) {
	const saved = new Map<string, unknown>()
	if (options.stored) saved.set('sessions', options.stored)
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	on('store.get', (_$, e) => ({ value: saved.get(e.key) }))
	on('store.set', (_$, e) => {
		saved.set(e.key, e.value)
		return { value: undefined }
	})
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: options.sessionId }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('agent.list', () => ({ value: options.agents ?? [] }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	return { clock, saved }
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
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

test('should save the rows under the session id', async ($, on) => {
	const { clock, saved } = world(on, {
		sessionId: 'session-a1b2c3',
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
	await clock.advance(1000)

	const stored = saved.get('sessions')

	expect(stored).toEqual({
		'session-a1b2c3': [
			expect.objectContaining({
				id: 'agent-1',
				type: 'Explore',
				description: 'Find auth callers',
				status: 'running',
			}),
		],
	})
})

test('should show a resumed session its rows, ended as killed', async ($, on) => {
	const { clock } = world(on, {
		sessionId: 'session-d4e5f6',
		stored: {
			'session-d4e5f6': [
				{
					id: 'agent-1',
					type: 'Plan',
					description: 'Outline the migration',
					status: 'running',
					startedAt: 1_799_999_000_000,
					recent: [],
					color: '#c678dd',
				},
				{
					id: 'agent-2',
					type: 'Explore',
					description: 'Find auth callers',
					status: 'completed',
					startedAt: 1_799_999_000_000,
					endedAt: 1_799_999_030_000,
					recent: [],
					color: '#c678dd',
				},
			],
		},
	})
	await startSession($)
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).toContain('Agents (0 running, 2 total)')
	expect(drawn).toContain('Outline the migration')
	expect(drawn).toContain('killed')
	expect(drawn).toContain('Find auth callers')
	expect(drawn).toContain('completed')
	await ui.unmount()
})

test('should not show rows stored for another session', async ($, on) => {
	const { clock } = world(on, {
		sessionId: 'session-d4e5f6',
		stored: {
			'session-0a9b8c': [
				{
					id: 'agent-1',
					type: 'Plan',
					description: 'Outline the migration',
					status: 'completed',
					startedAt: 1_799_999_000_000,
					recent: [],
					color: '#c678dd',
				},
			],
		},
	})
	await startSession($)
	await clock.advance(1000)

	const ui = await mountPane($)
	const drawn = await shown(ui)

	expect(drawn).not.toContain('Agents (')
	expect(drawn).not.toContain('Outline the migration')
	await ui.unmount()
})

test('should clip the title of a restored shell row whose stored title is a 200-character command', async ($, on) => {
	const command = `pnpm build && ${'rsync -az dist/ deploy@example.com:/srv/app && '.repeat(4)}echo done`
	const { clock } = world(on, {
		sessionId: 'session-g7h8i9',
		stored: {
			'session-g7h8i9': [
				{
					id: 'bash-7c1e',
					kind: 'shell',
					type: command.slice(0, 200),
					description: '',
					command,
					status: 'running',
					startedAt: 1_799_999_000_000,
					recent: [],
					color: '#c678dd',
				},
			],
		},
	})
	await startSession($)
	await clock.advance(1000)

	const ui = await mountPane($)
	const text = (await ui.find({ key: 'open:bash-7c1e' }))?.text ?? ''

	const title = text.match(/^● (.*?)\s+\(shell\)/)?.[1] ?? ''
	expect(command.slice(0, 200)).toHaveLength(200)
	expect(title.length).toBeLessThanOrEqual(60)
	expect(title.endsWith('…')).toBe(true)
	expect(text).toMatch(/\(shell\)\s+killed/)
	await ui.unmount()
})
