import type { AgentInfo, On, RenderPropsOf } from 'claude-code'
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

function world(
	on: On,
	options: { stored?: Record<string, unknown>; hasAgent?: boolean } = {}
) {
	const agents: AgentInfo[] =
		options.hasAgent === false
			? []
			: [
					{
						id: 'agent-1',
						type: 'Explore',
						description: 'Find auth callers',
						status: 'running',
					},
				]
	const saved = new Map(Object.entries(options.stored ?? {}))
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	const hostBodyRows: (number | undefined)[] = []
	on('store.get', (_$, e) => ({ value: saved.get(e.key) }))
	on('store.set', (_$, e) => {
		saved.set(e.key, e.value)
		return { value: undefined }
	})
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('agent.list', () => ({ value: agents }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	// Stands in for the filetree plugin, which lays out for the rows it is told it has.
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		hostBodyRows.push(e.props.scroll?.bodyRows)
		return (
			<Box flexDirection="column">
				<Text>{FILETREE_TEXT}</Text>
			</Box>
		)
	})
	return { clock, hostBodyRows, saved }
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
const lastRows = (rows: (number | undefined)[]) => rows.at(-1)
const dividerText = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn({ in: 'divider' }))

test('should tell the host pane it has half the pane by default once an agent exists', async ($, on) => {
	const { clock, hostBodyRows } = world(on)
	await startSession($)
	await clock.advance(1000)

	const ui = await mountHost($)

	expect(lastRows(hostBodyRows)).toBe(20)
	await ui.unmount()
})

test('should leave the host pane its whole body while no agent exists', async ($, on) => {
	const { hostBodyRows } = world(on, { hasAgent: false })
	await startSession($)

	const ui = await mountHost($)

	expect(lastRows(hostBodyRows)).toBe(40)
	await ui.unmount()
})

test('should grow the host rows by the rows the divider is dragged down on the next draw', async ($, on) => {
	const { clock, hostBodyRows } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.post({ moveBy: 4, bodyRows: 40 }, { in: 'divider' })
	await ui.redraw()

	expect(lastRows(hostBodyRows)).toBe(24)
	await ui.unmount()
})

test('should shrink the host rows when the divider is dragged up', async ($, on) => {
	const { clock, hostBodyRows } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.post({ moveBy: -5, bodyRows: 40 }, { in: 'divider' })
	await ui.redraw()

	expect(lastRows(hostBodyRows)).toBe(15)
	await ui.unmount()
})

test('should stop the share at 15% and 85% however far the divider is dragged', async ($, on) => {
	const { clock, hostBodyRows } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.post({ moveBy: 500, bodyRows: 40 }, { in: 'divider' })
	await ui.redraw()
	expect(lastRows(hostBodyRows)).toBe(34)

	await ui.post({ moveBy: -500, bodyRows: 40 }, { in: 'divider' })
	await ui.redraw()
	expect(lastRows(hostBodyRows)).toBe(6)
	await ui.unmount()
})

test('should save the share only when the divider is released', async ($, on) => {
	const { clock, saved } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.post({ moveBy: 4, bodyRows: 40 }, { in: 'divider' })
	expect(saved.has('share')).toBe(false)

	await ui.post({ done: true }, { in: 'divider' })
	expect(saved.has('share')).toBe(true)
	await ui.unmount()
})

test('should restore the saved share in a new session over a drag that was never released', async ($, on) => {
	const { clock, hostBodyRows } = world(on, { stored: { share: 0.7 } })
	await startSession($)
	await clock.advance(1000)
	const first = await mountHost($)
	await first.post({ moveBy: -10, bodyRows: 40 }, { in: 'divider' })
	await first.redraw()
	expect(lastRows(hostBodyRows)).toBe(18)
	await first.unmount()

	await startSession($)
	await clock.advance(1000)
	const second = await mountHost($)

	expect(lastRows(hostBodyRows)).toBe(28)
	await second.unmount()
})

test('should save the dragged share unchanged on release and restore that exact share in a new session', async ($, on) => {
	const { clock, hostBodyRows, saved } = world(on)
	await startSession($)
	await clock.advance(1000)
	const first = await mountHost($)

	await first.post({ moveBy: 4, bodyRows: 40 }, { in: 'divider' })
	await first.post({ done: true }, { in: 'divider' })
	expect(saved.get('share')).toBe(0.6)

	await first.post({ moveBy: 8, bodyRows: 40 }, { in: 'divider' })
	await first.unmount()
	await startSession($)
	await clock.advance(1000)
	const second = await mountHost($)

	expect(lastRows(hostBodyRows)).toBe(24)
	await second.unmount()
})

test('should fall back to an even split when the stored share is garbage', async ($, on) => {
	const { clock, hostBodyRows } = world(on, { stored: { share: 'wide' } })
	await startSession($)
	await clock.advance(1000)

	const ui = await mountHost($)

	expect(lastRows(hostBodyRows)).toBe(20)
	await ui.unmount()
})

test('should clamp a stored share that is out of range', async ($, on) => {
	const { clock, hostBodyRows } = world(on, { stored: { share: 0.99 } })
	await startSession($)
	await clock.advance(1000)

	const ui = await mountHost($)

	expect(lastRows(hostBodyRows)).toBe(34)
	await ui.unmount()
})

test('should move the host rows by the rows a pointer drag covers and save on release', async ($, on) => {
	const { clock, hostBodyRows, saved } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'divider' })
	await ui.pointer({ type: 'move', x: 3, y: 4, in: 'divider' })
	await ui.redraw()
	expect(lastRows(hostBodyRows)).toBe(24)
	expect(saved.has('share')).toBe(false)

	await ui.pointer({ type: 'up', x: 3, y: 4, button: 'left', in: 'divider' })
	expect(saved.has('share')).toBe(true)
	await ui.unmount()
})

test('should post at most one move per 60ms while dragging', async ($, on) => {
	const { clock, hostBodyRows } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'divider' })
	await ui.pointer({ type: 'move', x: 3, y: 2, in: 'divider' })
	await ui.pointer({ type: 'move', x: 3, y: 3, in: 'divider' })
	await ui.redraw()

	expect(lastRows(hostBodyRows)).toBe(22)
	await ui.unmount()
})

test('should ignore pointer moves when the divider is not held', async ($, on) => {
	const { clock, hostBodyRows } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.pointer({ type: 'move', x: 3, y: 5, in: 'divider' })
	await ui.redraw()

	expect(lastRows(hostBodyRows)).toBe(20)
	await ui.unmount()
})

test('should light the divider with a resize mark while hovered and dim it on leave', async ($, on) => {
	const { clock } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)
	expect(await dividerText(ui)).not.toContain('⇕')

	await ui.pointer({ type: 'move', x: 3, y: 0, in: 'divider' })
	expect(await dividerText(ui)).toContain('⇕')

	await ui.pointer({ type: 'leave', x: 3, y: 0, in: 'divider' })
	expect(await dividerText(ui)).not.toContain('⇕')
	await ui.unmount()
})

test('should keep the divider lit while dragging even when the pointer leaves its row', async ($, on) => {
	const { clock } = world(on)
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'divider' })
	await ui.pointer({ type: 'move', x: 3, y: 3, in: 'divider' })

	expect(await dividerText(ui)).toContain('⇕')
	await ui.unmount()
})
