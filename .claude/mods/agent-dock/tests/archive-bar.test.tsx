import type { AgentInfo, On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

const MINUTE = 60_000
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
	const toasts: string[] = []
	mock.store(on)
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('command.register', (_$, e) => ({ value: { command: e.name } }))
	on('agent.list', () => ({ value: agents }))
	on('ui.open', () => ({ value: { isPlaced: true } }))
	on('ui.toast', (_$, e) => {
		toasts.push(e.text)
		return { value: undefined }
	})
	on('session.messages', () => ({
		value: [
			{ role: 'assistant', text: 'Checking the login flow', toolUses: [] },
		],
	}))
	on('ui.render', { component: 'Pane', requestId: 'filetree' }, ($, e) => {
		const { Box, Text } = $.ui.resolve(e)
		return (
			<Box flexDirection="column">
				<Text>README.md</Text>
			</Box>
		)
	})
	return { clock, toasts }
}

const exploring: AgentInfo = {
	id: 'agent-1',
	type: 'Explore',
	description: 'Find auth callers',
	status: 'running',
}
const planning: AgentInfo = {
	id: 'agent-2',
	type: 'Plan',
	description: 'Outline the migration',
	status: 'running',
}
const testing: AgentInfo = {
	id: 'agent-3',
	type: 'general-purpose',
	description: 'Run the test suite',
	status: 'running',
}

const startSession = ($: Engine) =>
	$.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
const mountHost = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
	$.ui.mount({
		plugin: 'agent-dock',
		surface,
		component: 'Pane',
		requestId: 'filetree',
		props: paneProps,
	})
const shown = async (ui: Pick<Mounted, 'drawn'>) =>
	JSON.stringify(await ui.drawn())

test('should hide the archive bar when nothing is archived and nothing is finished', async ($, on) => {
	const { clock } = world(on, [exploring, planning])
	await startSession($)
	await clock.advance(1000)

	const ui = await mountHost($)

	expect(await ui.find({ key: 'archive:toggle' })).toBeUndefined()
	expect(await ui.find({ key: 'archive:finished' })).toBeUndefined()
	expect(await shown(ui)).not.toContain('Archived')
	await ui.unmount()
})

test('should offer to archive the finished agents with their count', async ($, on) => {
	const { clock } = world(on, [
		exploring,
		{ ...planning, status: 'completed' },
		{ ...testing, status: 'failed' },
	])
	await startSession($)
	await clock.advance(1000)

	const ui = await mountHost($)

	expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
		'▸ Archived (0)'
	)
	expect((await ui.find({ key: 'archive:finished' }))?.text).toContain(
		'archive 2 finished'
	)
	await ui.unmount()
})

test('should archive every finished agent and keep running ones listed when archive finished is pressed', async ($, on) => {
	const { clock } = world(on, [
		exploring,
		{ ...planning, status: 'completed' },
		{ ...testing, status: 'killed' },
	])
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)

	await ui.press({ key: 'archive:finished' })
	const drawn = await shown(ui)

	expect(drawn).toContain('Find auth callers')
	expect(drawn).not.toContain('Outline the migration')
	expect(drawn).not.toContain('Run the test suite')
	expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
		'▸ Archived (2)'
	)
	expect(await ui.find({ key: 'archive:finished' })).toBeUndefined()
	await ui.unmount()
})

test('should list archived agents after the unarchived ones, newest first, while the archive is open', async ($, on) => {
	const agents: AgentInfo[] = [{ ...exploring, status: 'completed' }]
	const { clock } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	agents.push({ ...planning, status: 'failed' })
	await clock.advance(1000)
	agents.push(testing)
	await clock.advance(1000)
	const ui = await mountHost($)
	await ui.press({ key: 'archive:finished' })

	await ui.press({ key: 'archive:toggle' })
	const drawn = await shown(ui)

	expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
		'▾ Archived (2)'
	)
	expect(drawn.indexOf('Run the test suite')).toBeGreaterThan(-1)
	expect(drawn.indexOf('Run the test suite')).toBeLessThan(
		drawn.indexOf('Outline the migration')
	)
	expect(drawn.indexOf('Outline the migration')).toBeLessThan(
		drawn.indexOf('Find auth callers')
	)

	await ui.press({ key: 'archive:toggle' })
	const closed = await shown(ui)

	expect(closed).toContain('Run the test suite')
	expect(closed).not.toContain('Outline the migration')
	expect(closed).not.toContain('Find auth callers')
	await ui.unmount()
})

test('should reset the scroll offset when the archive is opened and closed', async ($, on) => {
	const agents: AgentInfo[] = [exploring]
	const { clock } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	agents.push({ ...planning, status: 'completed' })
	await clock.advance(1000)
	agents.push(testing)
	await clock.advance(1000)
	const ui = await mountHost($)
	await $.ui.scroll({
		component: 'Pane',
		requestId: 'filetree',
		offset: 0,
		by: 1,
		bodyRows: 40,
		contentRows: 40,
		origin: { kind: 'person' },
		pointer: { column: 5, row: 25 },
	})
	await ui.redraw()
	expect(await shown(ui)).not.toContain('Run the test suite')

	await ui.press({ key: 'archive:toggle' })

	expect(await shown(ui)).toContain('Run the test suite')
	await ui.unmount()
})

test('should not show the archive bar while a transcript is open', async ($, on) => {
	const { clock } = world(on, [exploring, { ...planning, status: 'completed' }])
	await startSession($)
	await clock.advance(1000)
	const ui = await mountHost($)
	expect(await ui.find({ key: 'archive:toggle' })).toBeDefined()

	await ui.press({ key: 'open:agent-1' })

	expect(await shown(ui)).toContain('Checking the login flow')
	expect(await ui.find({ key: 'archive:toggle' })).toBeUndefined()
	expect(await ui.find({ key: 'archive:finished' })).toBeUndefined()

	await ui.press({ key: 'back' })

	expect(await ui.find({ key: 'archive:toggle' })).toBeDefined()
	await ui.unmount()
})

for (const surface of ['terminal', 'desktop'] as const) {
	test(`should archive finished agents from the bar on the ${surface} surface`, async ($, on) => {
		const agents: AgentInfo[] = [planning]
		const { clock } = world(on, agents)
		await startSession($)
		await clock.advance(1000)
		agents[0] = { ...planning, status: 'completed' }
		await clock.advance(1000)
		const ui = await mountHost($, surface)

		await ui.press({ key: 'archive:finished' })

		expect(await shown(ui)).not.toContain('Outline the migration')
		expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
			'▸ Archived (1)'
		)
		await ui.unmount()
	})
}

test('should auto-archive an agent 20 minutes after it finished by default', async ($, on) => {
	const agents: AgentInfo[] = [planning]
	const { clock } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	agents[0] = { ...planning, status: 'completed' }
	await clock.advance(1000)
	const ui = await mountHost($)

	await clock.advance(19 * MINUTE)
	expect(await shown(ui)).toContain('Outline the migration')

	await clock.advance(2 * MINUTE)
	await ui.redraw()

	expect(await shown(ui)).not.toContain('Outline the migration')
	expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
		'▸ Archived (1)'
	)
	await ui.unmount()
})

test(
	'should auto-archive after the configured number of minutes',
	{ options: { autoArchiveMinutes: 2 } },
	async ($, on) => {
		const agents: AgentInfo[] = [planning]
		const { clock } = world(on, agents)
		await startSession($)
		await clock.advance(1000)
		agents[0] = { ...planning, status: 'completed' }
		await clock.advance(1000)
		const ui = await mountHost($)

		await clock.advance(1 * MINUTE)
		expect(await shown(ui)).toContain('Outline the migration')

		await clock.advance(2 * MINUTE)
		await ui.redraw()

		expect(await shown(ui)).not.toContain('Outline the migration')
		await ui.unmount()
	}
)

for (const autoArchiveMinutes of [0, -1]) {
	test(
		`should never auto-archive when autoArchiveMinutes is ${autoArchiveMinutes}`,
		{ options: { autoArchiveMinutes } },
		async ($, on) => {
			const agents: AgentInfo[] = [planning]
			const { clock } = world(on, agents)
			await startSession($)
			await clock.advance(1000)
			agents[0] = { ...planning, status: 'completed' }
			await clock.advance(1000)
			const ui = await mountHost($)

			await clock.advance(60 * MINUTE)
			await ui.redraw()

			expect(await shown(ui)).toContain('Outline the migration')
			expect(await ui.find({ key: 'archive:finished' })).toBeDefined()
			await ui.unmount()
		}
	)
}

test('should unarchive an archived agent that runs again and move it to the top', async ($, on) => {
	const agents: AgentInfo[] = [{ ...exploring, status: 'completed' }]
	const { clock } = world(on, agents)
	await startSession($)
	await clock.advance(1000)
	agents.push(planning)
	await clock.advance(1000)
	const ui = await mountHost($)
	await ui.press({ key: 'archive:finished' })
	expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
		'Archived (1)'
	)

	agents[0] = { ...exploring, status: 'running' }
	await clock.advance(1000)
	await ui.redraw()
	const drawn = await shown(ui)

	expect(await ui.find({ key: 'archive:toggle' })).toBeUndefined()
	expect(drawn.indexOf('Find auth callers')).toBeGreaterThan(-1)
	expect(drawn.indexOf('Find auth callers')).toBeLessThan(
		drawn.indexOf('Outline the migration')
	)
	await ui.unmount()
})

for (const status of ['failed', 'killed'] as const) {
	test(`should toast once when a live agent is reported ${status}`, async ($, on) => {
		const agents: AgentInfo[] = [exploring]
		const { clock, toasts } = world(on, agents)
		await startSession($)
		await clock.advance(1000)
		expect(toasts).toEqual([])

		agents[0] = { ...exploring, status }
		await clock.advance(1000)
		await clock.advance(1000)
		await clock.advance(1000)

		expect(toasts).toEqual([
			`agent-dock: Explore "Find auth callers" ${status}`,
		])
	})
}

test('should not toast when a live agent completes or when an agent first appears already failed', async ($, on) => {
	const agents: AgentInfo[] = [exploring]
	const { clock, toasts } = world(on, agents)
	await startSession($)
	await clock.advance(1000)

	agents[0] = { ...exploring, status: 'completed' }
	agents.push({ ...planning, status: 'failed' })
	await clock.advance(1000)
	await clock.advance(1000)

	expect(toasts).toEqual([])
})

test(
	'should archive an agent only after exactly the configured minutes have passed, not at them',
	{ options: { autoArchiveMinutes: 2 } },
	async ($, on) => {
		const agents: AgentInfo[] = [planning]
		const { clock } = world(on, agents)
		await startSession($)
		await clock.advance(1000)
		agents[0] = { ...planning, status: 'completed' }
		await clock.advance(1000)
		const ui = await mountHost($)

		await clock.advance(2 * MINUTE)
		await ui.redraw()
		expect(await shown(ui)).toContain('Outline the migration')

		await clock.advance(1000)
		await ui.redraw()

		expect(await shown(ui)).not.toContain('Outline the migration')
		await ui.unmount()
	}
)

test('should list an agent the engine first reports already completed, count it and let it be archived', async ($, on) => {
	const { clock } = world(on, [{ ...planning, status: 'completed' }])
	await startSession($)
	await clock.advance(1000)

	const ui = await mountHost($)

	expect(await shown(ui)).toContain('Agents (0 running, 1 total)')
	expect(await shown(ui)).toContain('Outline the migration')

	await ui.press({ key: 'archive:finished' })

	expect(await shown(ui)).not.toContain('Outline the migration')
	expect((await ui.find({ key: 'archive:toggle' }))?.text).toContain(
		'▸ Archived (1)'
	)
	await ui.unmount()
})
