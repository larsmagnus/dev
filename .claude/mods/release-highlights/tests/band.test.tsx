import type { On, RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

const CHANGELOG = `# Changelog

## 2.1.304

- Added \`/auto-mode-setup\`

## 2.1.295

- Added idle compaction
`
const usage = {
	input_tokens: 0,
	output_tokens: 0,
	cache_read_input_tokens: 0,
	cache_creation_input_tokens: 0,
}
const bandProps = {
	hasSurvey: false,
	isWorking: false,
	maxRows: 20,
	bodyColumns: 80,
	scroll: { offset: 0, bodyRows: 20 },
	view: {},
} satisfies RenderPropsOf['AbovePrompt']

const highlights = (count: number) =>
	JSON.stringify(
		Array.from({ length: count }, (_, i) => ({
			category: 'feature',
			text: `Added feature ${i + 1}`,
		}))
	)

/** An engine on `version` that last saw `lastSeen`, serving `changelog` and summarising it as `reply`; every store write and fetch is recorded in order. */
function upgraded(
	on: On,
	{
		lastSeen,
		changelog = { status: 200, text: CHANGELOG },
		reply = highlights(5),
	}: {
		lastSeen?: string
		changelog?: { status: number; text: string }
		reply?: string
	}
) {
	const calls: string[] = []
	const clock = mock.clock(on, { now: 1_800_000_000_000 })
	on('ui.render', ($, e) => {
		const { Text } = $.ui.resolve(e)
		return <Text>engine</Text>
	})
	on('session.start', (_$, e) => ({ cwd: e.cwd }))
	on('session.version', () => ({ value: { version: '2.1.304' } }))
	on('store.get', () => ({ value: lastSeen }))
	on('store.set', (_$, e) => {
		calls.push(`store:${String(e.value)}`)
		return { value: undefined }
	})
	on('ui.log', () => ({ value: undefined }))
	on('http.fetch', () => {
		calls.push('fetch')
		return {
			value: {
				...changelog,
				ok: changelog.status === 200,
				headers: {},
			},
		}
	})
	on('model.complete', () => ({
		value: { isAnswered: true, text: reply, usage },
	}))
	return { calls, clock }
}

/** Starts the session and lets the deferred announcement settle. */
const startSession = async ($: Engine, clock: MockClock) => {
	await $.session.start({
		cwd: '/work/punchdown',
		surface: 'terminal',
		isInteractive: true,
	})
	await clock.advance(0)
}

const mountBand = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
	$.ui.mount({
		plugin: 'release-highlights',
		surface,
		component: 'AbovePrompt',
		props: bandProps,
	})

test('should say nothing on the first run and remember the version', async ($, on) => {
	const { calls, clock } = upgraded(on, {})
	await startSession($, clock)

	expect(JSON.stringify(await (await mountBand($)).drawn())).not.toContain(
		'release-highlights'
	)
	expect(calls).toEqual(['store:2.1.304'])
})

for (const surface of ['terminal', 'desktop'] as const)
	test(`should head the band with the old and new version on ${surface}`, async ($, on) => {
		const { clock } = upgraded(on, { lastSeen: '2.1.295' })
		await startSession($, clock)

		const drawn = JSON.stringify(await (await mountBand($, surface)).drawn())

		expect(drawn).toContain('release-highlights')
		expect(drawn).toContain('2.1.295')
		expect(drawn).toContain('2.1.304')
		expect(drawn).toContain('https://code.claude.com/docs/en/changelog#2-1-304')
	})

test('should show three highlights and offer the rest', async ($, on) => {
	const { clock } = upgraded(on, { lastSeen: '2.1.295' })
	await startSession($, clock)

	const drawn = JSON.stringify(await (await mountBand($)).drawn())

	expect(drawn).toContain('Added feature 3')
	expect(drawn).not.toContain('Added feature 4')
	expect(drawn).toContain('Show 2 more')
})

test('should show every highlight once expanded', async ($, on) => {
	const { clock } = upgraded(on, { lastSeen: '2.1.295' })
	await startSession($, clock)

	const band = await mountBand($)
	await band.press({ key: 'expand' })

	expect(JSON.stringify(await band.drawn())).toContain('Added feature 5')
})

test('should remove the band when dismissed', async ($, on) => {
	const { clock } = upgraded(on, { lastSeen: '2.1.295' })
	await startSession($, clock)

	const band = await mountBand($)
	await band.press({ key: 'dismiss' })

	expect(JSON.stringify(await band.drawn())).not.toContain('release-highlights')
})

test('should claim the version before it fetches, so a reload meanwhile skips the upgrade', async ($, on) => {
	const { calls, clock } = upgraded(on, { lastSeen: '2.1.295' })
	await startSession($, clock)

	expect(calls).toEqual(['store:2.1.304', 'fetch'])
})

test('should hand the version back when the changelog cannot be fetched, so the next session retries', async ($, on) => {
	const { calls, clock } = upgraded(on, {
		lastSeen: '2.1.295',
		changelog: { status: 503, text: '' },
	})
	await startSession($, clock)

	expect(calls).toEqual(['store:2.1.304', 'fetch', 'store:2.1.295'])
})

test('should hand the version back when the summary holds no highlights', async ($, on) => {
	const { calls, clock } = upgraded(on, {
		lastSeen: '2.1.295',
		reply: 'Nothing.',
	})
	await startSession($, clock)

	expect(calls.at(-1)).toBe('store:2.1.295')
})
