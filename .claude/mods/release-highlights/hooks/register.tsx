import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Category, Highlight } from '../types'

import {
	compareVersions,
	parseHighlights,
	sectionsBetween,
	summarisePrompt,
} from './changelog'

const CHANGELOG_URL =
	'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md'
const CHANGELOG_PAGE_URL = 'https://code.claude.com/docs/en/changelog'
const LAST_SEEN_KEY = 'lastSeenVersion'
const COLLAPSED_COUNT = 3

const CATEGORY_LABEL: Record<Category, string> = {
	feature: 'new',
	change: 'changed',
	breaking: 'breaking',
	other: 'other',
}

const release = atom(
	{ plugin: 'release-highlights', key: 'release' } as const,
	null
)
const isExpanded = atom(
	{ plugin: 'release-highlights', key: 'isExpanded' } as const,
	false
)

/** The press that reveals every highlight. */
const expand = ($: EngineInterface) => () => update($, isExpanded, () => true)

/** The press that hides the band until the next upgrade. */
const dismiss = ($: EngineInterface) => () => update($, release, () => null)

/** Highlights for the releases after `from` up to `to`; empty when the changelog has none, throws when the fetch or the summary fails. */
async function summarise(
	$: EngineInterface,
	from: string,
	to: string
): Promise<Highlight[]> {
	const changelog = await $.http.fetch(CHANGELOG_URL)
	if (!changelog.ok) throw new Error(`changelog responded ${changelog.status}`)

	const sections = sectionsBetween(changelog.text, from, to)
	if (sections.length === 0) return []

	const reply = await $.model.complete({
		model: 'haiku',
		prompt: summarisePrompt(sections),
	})
	if (!reply.isAnswered) throw new Error(`summary failed: ${reply.reason}`)

	const items = parseHighlights(reply.text)
	if (items.length === 0) throw new Error('summary held no highlights')

	return items
}

/** Shows highlights once per upgrade; claims the upgrade before the slow work so a reload or second session starting meanwhile skips it, and hands the claim back on failure so the next session retries. Never rejects, as nothing awaits it. */
async function announceUpdate($: EngineInterface): Promise<void> {
	let claimed: string | undefined

	try {
		const { version, base } = await $.session.version()
		const current = base ?? version
		const stored = await $.store.get(LAST_SEEN_KEY)
		const lastSeen = typeof stored === 'string' ? stored : undefined

		await $.store.set(LAST_SEEN_KEY, current)
		if (lastSeen === undefined || compareVersions(current, lastSeen) <= 0)
			return

		claimed = lastSeen
		const items = await summarise($, lastSeen, current)
		if (items.length > 0)
			await update($, release, () => ({ from: lastSeen, to: current, items }))
	} catch (error) {
		if (claimed !== undefined)
			await $.store.set(LAST_SEEN_KEY, claimed).catch(() => undefined)
		$.ui.log(
			`release-highlights: ${error instanceof Error ? error.message : String(error)}`
		)
	}
}

export const register: Register = (on) => {
	on('session.start', async ($, e, next) => {
		if (e.isInteractive) $.clock.after(0, () => announceUpdate($))

		return next(e)
	})

	on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
		const current = await read($, release)
		if (e.props.hasSurvey || current === null) return next(e)

		const expanded = await read($, isExpanded)
		const { Box, Button, Link, Text } = $.ui.resolve(e)
		const shown = expanded
			? current.items
			: current.items.slice(0, COLLAPSED_COUNT)
		const hiddenCount = current.items.length - shown.length

		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="suggestion"
				paddingX={2}
				paddingY={1}
				gap="xs"
			>
				<Box justifyContent="space-between">
					<Text bold>
						<Text color="claude">release-highlights</Text>{' '}
						<Text dimColor>{current.from} →</Text>{' '}
						<Text color="success">{current.to}</Text>{' '}
						<Link
							href={`${CHANGELOG_PAGE_URL}#${current.to.replaceAll('.', '-')}`}
							label="full changelog ↗"
						/>
					</Text>
					<Button key="dismiss" label="x" onPress={dismiss($)} />
				</Box>
				{shown.map((item, i) => (
					<Text key={`highlight-${i}`}>
						<Text dimColor>[{CATEGORY_LABEL[item.category]}]</Text> {item.text}
					</Text>
				))}
				{hiddenCount > 0 && (
					<Button
						key="expand"
						label={`Show ${hiddenCount} more`}
						onPress={expand($)}
					/>
				)}
			</Box>
		)
	})
}
