import type { AgentInfo, On, RenderPropsOf, SessionMessage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

const paneProps = {
	title: 'Files',
	isFocused: false,
	bodyColumns: 60,
	placement: 'dock',
	scroll: { offset: 0, bodyRows: 80 },
	view: {},
} satisfies RenderPropsOf['Pane']

const agents: AgentInfo[] = [
	{
		id: 'agent-1',
		type: 'Explore',
		description: 'Fix the login redirect',
		status: 'running',
	},
]

function world(on: On, transcript: SessionMessage[]) {
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	mock.store(on)
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.id', () => ({ value: 'session-4f2a9c' }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('agent.list', () => ({ value: agents }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('session.messages', () => ({ value: transcript }))
	on('tool.call', () => ({ result: { stdout: '', stderr: '' } }))
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

const openTranscript = async (
	$: Engine,
	clock: { advance: (ms: number) => Promise<void> }
) => {
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	await clock.advance(1000)
	const ui = await $.ui.mount({
		plugin: 'agent-dock',
		surface: 'terminal',
		component: 'Pane',
		requestId: 'filetree',
		props: paneProps,
	})
	await ui.press({ key: 'open:agent-1' })
	return ui
}
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

const assistant = (toolUses: SessionMessage['toolUses']): SessionMessage[] => [
	{ role: 'assistant', text: 'Patching the redirect', toolUses },
]

test('should show the removed and added lines under an Edit', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-edit-1',
				tool: 'Edit',
				input: {
					file_path: 'src/login.ts',
					old_string: 'redirect("/home")',
					new_string: 'redirect("/dashboard")',
				},
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain('⏺ Edit(src/login.ts)')
	expect(drawn).toContain('  - redirect(\\"/home\\")')
	expect(drawn).toContain('  + redirect(\\"/dashboard\\")')
	expect(drawn.indexOf('  - redirect')).toBeLessThan(
		drawn.indexOf('  + redirect')
	)
	await ui.unmount()
})

test('should show every edit of a MultiEdit', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-multi-1',
				tool: 'MultiEdit',
				input: {
					file_path: 'src/session.ts',
					edits: [
						{ old_string: 'timeout = 30', new_string: 'timeout = 60' },
						{ old_string: 'retries = 1', new_string: 'retries = 3' },
						{ old_string: 'secure = false', new_string: 'secure = true' },
					],
				},
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	for (const line of [
		'  - timeout = 30',
		'  + timeout = 60',
		'  - retries = 1',
		'  + retries = 3',
		'  - secure = false',
		'  + secure = true',
	])
		expect(drawn).toContain(line)
	await ui.unmount()
})

test('should add no diff lines for a Write or a Read', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-write-1',
				tool: 'Write',
				input: { file_path: 'src/logout.ts', content: 'export const out = 1' },
			},
			{
				tool_use_id: 'toolu-read-1',
				tool: 'Read',
				input: { file_path: 'src/login.ts' },
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain('⏺ Write(src/logout.ts)')
	expect(drawn).toContain('⏺ Read(src/login.ts)')
	expect(drawn).not.toContain('  - ')
	expect(drawn).not.toContain('  + ')
	expect(drawn).not.toContain('export const out = 1')
	await ui.unmount()
})

test('should cap a long old_string at ten lines and end it with an ellipsis', async ($, on) => {
	const oldLines = Array.from({ length: 14 }, (_, i) => `legacyStep${i + 1}()`)
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-edit-2',
				tool: 'Edit',
				input: {
					file_path: 'src/pipeline.ts',
					old_string: oldLines.join('\n'),
					new_string: 'runPipeline()',
				},
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain('  - legacyStep10()')
	expect(drawn).not.toContain('legacyStep11()')
	expect(drawn).toContain('  - …')
	expect(drawn).toContain('  + runPipeline()')
	await ui.unmount()
})

test('should colour removed lines red and added lines green', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-edit-3',
				tool: 'Edit',
				input: {
					file_path: 'src/login.ts',
					old_string: 'const mode = legacy',
					new_string: 'const mode = modern',
				},
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain(
		'"color":"#e06c75"},"children":["  - const mode = legacy"]'
	)
	expect(drawn).toContain(
		'"color":"#98c379"},"children":["  + const mode = modern"]'
	)
	await ui.unmount()
})
