import { expect, test } from 'claude-code/testing'

import {
	CATEGORY_ORDER,
	compareVersions,
	parseHighlights,
	sectionsBetween,
} from '../hooks/changelog'

const CHANGELOG = `# Changelog

## 2.1.304

- Added \`/auto-mode-setup\`

## 2.1.303

- Fixed the organization policy refresh

## 2.1.295

- Added idle compaction
`

test('should compare versions numerically, not as text', () => {
	expect(compareVersions('2.1.304', '2.1.99')).toBeGreaterThan(0)
	expect(compareVersions('2.1.99', '2.1.304')).toBeLessThan(0)
})

test('should treat a dev build as its release', () => {
	expect(compareVersions('2.1.304-dev', '2.1.304')).toBe(0)
})

test('should take the releases after the last seen one up to the running one', () => {
	expect(sectionsBetween(CHANGELOG, '2.1.295', '2.1.304')).toEqual([
		'## 2.1.304\n\n- Added `/auto-mode-setup`',
		'## 2.1.303\n\n- Fixed the organization policy refresh',
	])
})

test('should leave out releases newer than the running version', () => {
	expect(sectionsBetween(CHANGELOG, '2.1.295', '2.1.303')).toEqual([
		'## 2.1.303\n\n- Fixed the organization policy refresh',
	])
})

test('should find nothing when the last seen version is the running one', () => {
	expect(sectionsBetween(CHANGELOG, '2.1.304', '2.1.304')).toEqual([])
})

test('should cap a long absence at the newest fifteen releases', () => {
	const long = Array.from(
		{ length: 20 },
		(_, i) => `## 2.1.${300 + i}\n\n- Fixed thing ${i}`
	).join('\n\n')

	const sections = sectionsBetween(long, '2.1.0', '2.1.319')

	expect(sections).toHaveLength(15)
	expect(sections[0]).toContain('2.1.300')
})

test('should read highlights out of a reply wrapped in prose', () => {
	const reply = `Here you go:\n[{"category":"feature","text":"Added /auto-mode-setup"}]`

	expect(parseHighlights(reply)).toEqual([
		{ category: 'feature', text: 'Added /auto-mode-setup' },
	])
})

test('should drop entries of the wrong shape', () => {
	const reply = JSON.stringify([
		{ category: 'feature', text: 'Added idle compaction' },
		{ category: 'rumour', text: 'Unknown category' },
		{ category: 'other' },
		'Not an object',
	])

	expect(parseHighlights(reply)).toEqual([
		{ category: 'feature', text: 'Added idle compaction' },
	])
})

test('should find no highlights in a reply without a list', () => {
	expect(parseHighlights('Nothing notable.')).toEqual([])
})

test('should order highlights feature, change, breaking, other whatever order the model chose', () => {
	const reply = JSON.stringify(
		[...CATEGORY_ORDER].toReversed().map((category) => ({
			category,
			text: `A ${category} entry`,
		}))
	)

	expect(parseHighlights(reply).map((highlight) => highlight.category)).toEqual(
		['feature', 'change', 'breaking', 'other']
	)
})
