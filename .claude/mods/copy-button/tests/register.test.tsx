import { expect, test } from 'claude-code/testing'

const reply = 'Run `npm test` to check the **migration** before deploying.'

test('should show a copy button above a short message', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: reply, isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button', key: 'copy-above' })).toBeDefined()
})

test('should not show a lower copy button on a short message', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: reply, isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeUndefined()
})

test('should show a lower copy button at the default long message length', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: 'a'.repeat(2000), isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeDefined()
})

test('should not show a lower copy button just under the default long message length', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: 'a'.repeat(1999), isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeUndefined()
})

test(
	'should show a lower copy button at a configured long message length',
	{ options: { longMessageChars: 500 } },
	async ($, on) => {
		on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
			const { Text } = engine.ui.resolve(e)
			return <Text>engine drawing</Text>
		})

		const ui = await $.ui.mount({
			plugin: 'copy-button',
			surface: 'terminal',
			component: 'AssistantMessage',
			props: { text: 'a'.repeat(500), isFirstOfReply: true },
		})

		expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeDefined()
	}
)

test(
	'should not show a lower copy button just under a configured long message length',
	{ options: { longMessageChars: 500 } },
	async ($, on) => {
		on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
			const { Text } = engine.ui.resolve(e)
			return <Text>engine drawing</Text>
		})

		const ui = await $.ui.mount({
			plugin: 'copy-button',
			surface: 'terminal',
			component: 'AssistantMessage',
			props: { text: 'a'.repeat(499), isFirstOfReply: true },
		})

		expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeUndefined()
	}
)

test('should show a lower copy button on a message taller than the viewport', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})
	const tallText = Array.from(
		{ length: 30 },
		(_, i) => `Step ${i + 1}: restart the worker`
	).join('\n')

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		viewport: { columns: 80, rows: 24 },
		props: { text: tallText, isFirstOfReply: true },
	})

	expect(tallText.length).toBeLessThan(2000)
	expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeDefined()
})

test('should not show a lower copy button on a short message in a viewport', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		viewport: { columns: 80, rows: 24 },
		props: { text: reply, isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeUndefined()
})

test('should copy the exact markdown and toast when the button is pressed', async ($, on) => {
	const copied: string[] = []
	const toasts: string[] = []
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})
	on('ui.copy', (_$, e) => {
		copied.push(e.text)
		return { value: { isCopied: true } }
	})
	on('ui.toast', (_$, e) => {
		toasts.push(e.text)
		return { value: undefined }
	})
	const markdown = '## Deploy\n\n- Run `npm test`\n- Tag **v2.4.1**\n'

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: markdown, isFirstOfReply: true },
	})
	await ui.press({ key: 'copy-above' })

	expect(copied).toEqual([markdown])
	expect(toasts).toEqual(['Message copied'])
})

test('should copy the exact markdown when the lower button is pressed', async ($, on) => {
	const copied: string[] = []
	const toasts: string[] = []
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})
	on('ui.copy', (_$, e) => {
		copied.push(e.text)
		return { value: { isCopied: true } }
	})
	on('ui.toast', (_$, e) => {
		toasts.push(e.text)
		return { value: undefined }
	})
	const markdown = `Release notes:\n${'- Fixed the retry loop in the sync worker\n'.repeat(60)}`

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: markdown, isFirstOfReply: true },
	})
	await ui.press({ key: 'copy-below' })

	expect(copied).toEqual([markdown])
	expect(toasts).toEqual(['Message copied'])
})

test('should toast the reason when copying fails', async ($, on) => {
	const toasts: string[] = []
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})
	on('ui.copy', () => ({
		value: { isCopied: false, reason: 'no-clipboard' },
	}))
	on('ui.toast', (_$, e) => {
		toasts.push(e.text)
		return { value: undefined }
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: reply, isFirstOfReply: true },
	})
	await ui.press({ key: 'copy-above' })

	expect(toasts).toEqual(['Copy failed, no-clipboard'])
})

test('should leave a summary to the engine', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: {
			text: 'Summary: migrated the billing tables.',
			isFirstOfReply: true,
			isSummary: true,
		},
	})

	expect(await ui.find({ type: 'Button' })).toBeUndefined()
	expect(JSON.stringify(await ui.drawn())).toContain('engine drawing')
})

test('should leave a message to the engine on the desktop surface', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'desktop',
		component: 'AssistantMessage',
		props: { text: reply, isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button' })).toBeUndefined()
	expect(JSON.stringify(await ui.drawn())).toContain('engine drawing')
})

test('should keep the engine drawing of the message beside the button', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: reply, isFirstOfReply: true },
	})

	expect(JSON.stringify(await ui.drawn())).toContain('engine drawing')
})

test('should leave the engine drawing alone when the viewport is not fullscreen', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		viewport: { columns: 80, rows: 24, isFullscreen: false },
		props: { text: reply, isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button' })).toBeUndefined()
	expect(JSON.stringify(await ui.drawn())).toContain('engine drawing')
})

test('should show a copy button when the viewport is fullscreen', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		viewport: { columns: 80, rows: 24, isFullscreen: true },
		props: { text: reply, isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button', key: 'copy-above' })).toBeDefined()
})

test('should show no button on an empty message', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: '', isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button' })).toBeUndefined()
})

test('should show no button on a whitespace-only message', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: ' \n\t\n  ', isFirstOfReply: true },
	})

	expect(await ui.find({ type: 'Button' })).toBeUndefined()
})

test('should show a lower copy button on a single paragraph that wraps past a narrow viewport', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		viewport: { columns: 40, rows: 24 },
		props: {
			text: 'Deploy notes: '.repeat(72).slice(0, 1000),
			isFirstOfReply: true,
		},
	})

	expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeDefined()
})

test('should not show a lower copy button on the same paragraph in a wide viewport', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		viewport: { columns: 200, rows: 24 },
		props: {
			text: 'Deploy notes: '.repeat(72).slice(0, 1000),
			isFirstOfReply: true,
		},
	})

	expect(await ui.find({ type: 'Button', key: 'copy-below' })).toBeUndefined()
})

test('should draw the absolute copy button after the engine drawing', async ($, on) => {
	on('ui.render', { component: 'AssistantMessage' }, (engine, e) => {
		const { Text } = engine.ui.resolve(e)
		return <Text>engine drawing</Text>
	})

	const ui = await $.ui.mount({
		plugin: 'copy-button',
		surface: 'terminal',
		component: 'AssistantMessage',
		props: { text: reply, isFirstOfReply: true },
	})

	const drawn = JSON.stringify(await ui.drawn())
	expect(drawn.indexOf('engine drawing')).toBeGreaterThan(-1)
	expect(drawn.indexOf('"position":"absolute"')).toBeGreaterThan(
		drawn.indexOf('engine drawing')
	)
})
