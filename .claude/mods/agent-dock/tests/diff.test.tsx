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
	mock.store(on, { host: 'filetree' })
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

	expect(drawn).toContain('"bold":true},"children":["Edit"]')
	expect(drawn).toContain('(src/login.ts)')
	expect(drawn).toContain('  - redirect(\\"')
	expect(drawn).toContain('  + redirect(\\"')
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

	expect(drawn).toContain('"children":["Write"]')
	expect(drawn).toContain('(src/logout.ts)')
	expect(drawn).toContain('"children":["Read"]')
	expect(drawn).toContain('(src/login.ts)')
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

test('should show every line of the report a subagent handed back', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-handback-1',
				tool: 'SubagentHandback',
				input: {
					message:
						'Fixed the redirect.\n\nChanged: src/login.ts\nVerified: login.test.ts passes',
				},
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain('"children":["SubagentHandback"]')
	expect(drawn).toContain('Fixed the redirect.')
	expect(drawn).toContain('Changed: src/login.ts')
	expect(drawn).toContain('Verified: login.test.ts passes')
})

test('should show the first lines of what a call returned, clipped with an ellipsis', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-grep-1',
				tool: 'Grep',
				input: { pattern: 'redirect' },
				text: 'src/login.ts:12\nsrc/login.ts:40\nsrc/home.ts:3\nsrc/nav.ts:9',
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain('⎿ src/login.ts:12')
	expect(drawn).toContain('⎿ src/home.ts:3')
	expect(drawn).not.toContain('src/nav.ts:9')
	expect(drawn).toContain('⎿ …')
})

test('should mark a failed call in red with its error', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-bash-1',
				tool: 'Bash',
				input: { command: 'pnpm test' },
				text: 'Exit code 1\nlogin.test.ts failed',
				isError: true,
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain('⎿ Exit code 1')
	expect(drawn).toContain('"color":"#e06c75"},"children":["  ⎿ Exit code 1"]')
})

test('should not repeat an Edit success message under its diff', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-edit-2',
				tool: 'Edit',
				input: { file_path: 'src/login.ts', old_string: 'a', new_string: 'b' },
				text: 'The file src/login.ts has been updated successfully.',
			},
		])
	)
	const ui = await openTranscript($, clock)

	expect(await shown(ui)).not.toContain('updated successfully')
})

test('should colour API failures red and leave ordinary prose uncoloured', async ($, on) => {
	const clock = world(on, [
		{
			role: 'assistant',
			text: "You've hit your session limit · resets 6am (Australia/Sydney)",
			toolUses: [],
		},
		{ role: 'assistant', text: 'API Error: 529 overloaded', toolUses: [] },
		{ role: 'assistant', text: 'Patching the redirect', toolUses: [] },
	])
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain(
		'"dimColor":false,"color":"#e06c75"},"children":["You\'ve hit your session limit'
	)
	expect(drawn).toContain(
		'"dimColor":false,"color":"#e06c75"},"children":["API Error: 529 overloaded"]'
	)
	expect(drawn).not.toContain(
		'"dimColor":false,"color":"#e06c75"},"children":["Patching the redirect"]'
	)
	await ui.unmount()
})

test('should draw a call with a bullet in the agent colour, a bold name and dim arguments', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-read-2',
				tool: 'Read',
				input: { file_path: 'src/login.ts' },
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toMatch(/"color":"#[0-9a-f]{6}"\},"children":\["⏺ "\]/i)
	expect(drawn).toContain('"bold":true},"children":["Read"]')
	expect(drawn).toContain('"dimColor":true},"children":["(src/login.ts)"]')
	await ui.unmount()
})

test('should put a blank row before every call except the first line', async ($, on) => {
	const clock = world(
		on,
		assistant([
			{
				tool_use_id: 'toolu-read-3',
				tool: 'Read',
				input: { file_path: 'src/login.ts' },
			},
			{
				tool_use_id: 'toolu-read-4',
				tool: 'Read',
				input: { file_path: 'src/home.ts' },
			},
		])
	)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	// Prose is line 1, so both calls get a spacer; a leading call would not.
	expect(drawn.split('"dimColor":true},"children":["  "]}]}').length - 1).toBe(
		2
	)
	await ui.unmount()
})

test('should not put a blank row above a call that is the first line', async ($, on) => {
	const clock = world(on, [
		{
			role: 'assistant',
			text: '',
			toolUses: [
				{
					tool_use_id: 'toolu-read-5',
					tool: 'Read',
					input: { file_path: 'src/login.ts' },
				},
			],
		},
	])
	const ui = await openTranscript($, clock)

	expect(await shown(ui)).not.toContain('"children":[" "]')
	await ui.unmount()
})

const longCommand = `pnpm exec vitest run ${'src/session/login.test.ts '.repeat(6)}--reporter=verbose --tail-marker-xyz`
const longCall = assistant([
	{
		tool_use_id: 'toolu-bash-2',
		tool: 'Bash',
		input: { command: longCommand },
	},
])

test('should wrap a long call across rows by default', async ($, on) => {
	const clock = world(on, longCall)
	const ui = await openTranscript($, clock)

	const drawn = await shown(ui)

	expect(drawn).toContain('⊟')
	expect(drawn).toContain('tail-marker-xyz')
	await ui.unmount()
})

test('should collapse long calls to one row when the collapse button is pressed', async ($, on) => {
	const clock = world(on, longCall)
	const ui = await openTranscript($, clock)
	const wrapped = await shown(ui)

	await ui.press({ key: 'collapse' })
	const collapsed = await shown(ui)

	expect(collapsed).toContain('⊞')
	expect(collapsed).not.toContain('⊟')
	expect(wrapped).toContain('"dimColor":true},"children":["  "]}]}')
	expect(wrapped).not.toContain(longCommand)
	expect(collapsed).not.toContain('"dimColor":true},"children":["  "]}]}')
	expect(collapsed).toContain(longCommand)
	await ui.unmount()
})

test('should restore the wrapped rows when the collapse button is pressed again', async ($, on) => {
	const clock = world(on, longCall)
	const ui = await openTranscript($, clock)

	await ui.press({ key: 'collapse' })
	await ui.press({ key: 'collapse' })

	const restored = await shown(ui)
	expect(restored).toContain('⊟')
	expect(restored).toContain('tail-marker-xyz')
	expect(restored).toContain('"dimColor":true},"children":["  "]}]}')
	await ui.unmount()
})
