import { expect, test } from 'claude-code/testing'

import {
	isDue,
	ledgerDigest,
	mergeFindings,
	pending,
	resolve,
	skip,
} from '../hooks/ledger'
import { parseSuggestions, toLines } from '../hooks/parse'
import type { Finding, Suggestion } from '../types'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const finding = (key: string): Finding => ({
	key,
	project: '/work/punchdown',
	track: 'context',
	type: '~/.claude/CLAUDE.md',
	finding: `Finding for ${key}`,
	action: `Persist ${key}`,
	evidence: [`session-123 quote for ${key}`],
})

const suggestion = (
	key: string,
	status: Suggestion['status'] = 'pending'
): Suggestion => ({
	...finding(key),
	status,
	firstSeen: NOW - DAY,
	lastSeen: NOW - DAY,
	seenCount: 1,
})

test('should propose a new finding as pending and log it', () => {
	const { suggestions, events } = mergeFindings(
		[],
		[finding('verify-before-claiming')],
		NOW
	)

	expect(suggestions).toEqual([
		expect.objectContaining({
			key: 'verify-before-claiming',
			status: 'pending',
			seenCount: 1,
			firstSeen: NOW,
		}),
	])
	expect(events).toEqual([
		{ at: NOW, key: 'verify-before-claiming', event: 'proposed' },
	])
})

test('should count a repeated finding instead of duplicating it', () => {
	const { suggestions, events } = mergeFindings(
		[suggestion('read-before-edit')],
		[finding('read-before-edit')],
		NOW
	)

	expect(suggestions).toHaveLength(1)
	expect(suggestions[0]).toMatchObject({
		seenCount: 2,
		lastSeen: NOW,
		status: 'pending',
	})
	expect(events).toEqual([
		{ at: NOW, key: 'read-before-edit', event: 'repeated' },
	])
})

test('should reopen an applied suggestion that recurs', () => {
	const { suggestions, events } = mergeFindings(
		[suggestion('read-before-edit', 'applied')],
		[finding('read-before-edit')],
		NOW
	)

	expect(suggestions[0]?.status).toBe('pending')
	expect(events[0]?.note).toBe('recurred after applied; reopened')
})

for (const closed of ['declined', 'superseded'] as const)
	test(`should keep a ${closed} suggestion closed when it recurs`, () => {
		const { suggestions, events } = mergeFindings(
			[suggestion('terse-replies', closed)],
			[finding('terse-replies')],
			NOW
		)

		expect(suggestions[0]?.status).toBe(closed)
		expect(events).toEqual([
			{ at: NOW, key: 'terse-replies', event: 'repeated' },
		])
	})

test('should keep only the latest evidence of a lesson', () => {
	const many = {
		...suggestion('read-before-edit'),
		evidence: ['a', 'b', 'c', 'd', 'e'],
	}
	const { suggestions } = mergeFindings(
		[many],
		[{ ...finding('read-before-edit'), evidence: ['f'] }],
		NOW
	)

	expect(suggestions[0]?.evidence).toEqual(['b', 'c', 'd', 'e', 'f'])
})

test('should resolve only the named suggestions and log each with the note', () => {
	const { suggestions, events } = resolve(
		[suggestion('a-lesson'), suggestion('b-lesson'), suggestion('c-lesson')],
		['a-lesson', 'c-lesson', 'unknown-lesson'],
		'declined',
		NOW,
		'too noisy'
	)

	expect(suggestions.map((s) => s.status)).toEqual([
		'declined',
		'pending',
		'declined',
	])
	expect(events).toEqual([
		{ at: NOW, key: 'a-lesson', event: 'declined', note: 'too noisy' },
		{ at: NOW, key: 'c-lesson', event: 'declined', note: 'too noisy' },
	])
})

test('should list only pending suggestions for review', () => {
	const list = [
		suggestion('a-lesson'),
		suggestion('b-lesson', 'applied'),
		suggestion('c-lesson', 'declined'),
	]

	expect(pending(list).map((s) => s.key)).toEqual(['a-lesson'])
})

test('should digest every suggestion with its status', () => {
	expect(
		ledgerDigest([suggestion('a-lesson'), suggestion('b-lesson', 'declined')])
	).toBe(
		'a-lesson [pending] Finding for a-lesson\nb-lesson [declined] Finding for b-lesson'
	)
})

test('should not be due when nothing is queued, however long ago it ran', () => {
	expect(isDue({ lastRun: NOW - 30 * DAY }, 0, NOW)).toBe(false)
})

test('should be due after ten queued sessions', () => {
	expect(isDue({ lastRun: NOW - 2 * DAY }, 10, NOW)).toBe(true)
})

test('should not be due on nine queued sessions within the week', () => {
	expect(isDue({ lastRun: NOW - 2 * DAY }, 9, NOW)).toBe(false)
})

test('should be due once a week passed with anything queued', () => {
	expect(isDue({ lastRun: NOW - 7 * DAY }, 1, NOW)).toBe(true)
})

test('should be due on the first run once something is queued', () => {
	expect(isDue({ lastRun: null }, 1, NOW)).toBe(true)
})

test('should hold back a run within the hour of the last one', () => {
	expect(isDue({ lastRun: NOW - 60_000 }, 50, NOW)).toBe(false)
})

test('should round-trip the ledger and skip corrupt lines', () => {
	const stored = toLines([suggestion('a-lesson'), suggestion('b-lesson')])
	const torn = `${stored}{"key":"c-less`

	expect(parseSuggestions(torn).map((s) => s.key)).toEqual([
		'a-lesson',
		'b-lesson',
	])
})

test('should keep skipped suggestions pending with the reason and log it', () => {
	const { suggestions, events } = skip(
		[suggestion('a-lesson'), suggestion('b-lesson')],
		[{ key: 'a-lesson', note: 'target file is read-only' }],
		NOW
	)

	expect(suggestions.map((s) => s.status)).toEqual(['pending', 'pending'])
	expect(suggestions[0]?.note).toBe('target file is read-only')
	expect(suggestions[1]?.note).toBeUndefined()
	expect(events).toEqual([
		{
			at: NOW,
			key: 'a-lesson',
			event: 'skipped',
			note: 'target file is read-only',
		},
	])
})
