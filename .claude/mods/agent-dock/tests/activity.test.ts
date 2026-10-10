import { expect, test } from 'claude-code/testing'

import {
	addRow,
	describeCall,
	formatElapsed,
	MAX_AGENTS,
	withActivity,
} from '../hooks/activity'

test('formatElapsed should show seconds, minutes and hours at their boundaries', () => {
	expect(formatElapsed(42_000)).toBe('42s')
	expect(formatElapsed(59_999)).toBe('59s')
	expect(formatElapsed(60_000)).toBe('1m 00s')
	expect(formatElapsed(187_000)).toBe('3m 07s')
	expect(formatElapsed(3_600_000)).toBe('1h 00m')
	expect(formatElapsed(3_720_000)).toBe('1h 02m')
})

test('formatElapsed should never go negative', () => {
	expect(formatElapsed(-5_000)).toBe('0s')
})

test('withActivity should keep only the two newest tool calls', () => {
	const recent = ['⏺ Read(src/app.ts)', '⏺ Grep(useState)']

	expect(withActivity(recent, '⏺ Edit(src/app.ts)')).toEqual([
		'⏺ Grep(useState)',
		'⏺ Edit(src/app.ts)',
	])
})

test('withActivity should replace the previous streamed text line instead of stacking text', () => {
	const recent = ['⏺ Read(src/app.ts)', 'Looking at the']

	expect(withActivity(recent, 'Looking at the imports')).toEqual([
		'⏺ Read(src/app.ts)',
		'Looking at the imports',
	])
})

test('withActivity should keep a tool call when text follows it', () => {
	expect(withActivity(['⏺ Read(src/app.ts)'], 'Done reading')).toEqual([
		'⏺ Read(src/app.ts)',
		'Done reading',
	])
})

test('withActivity should keep streamed text when a tool call follows it', () => {
	expect(withActivity(['Looking around'], '⏺ Bash(pnpm test)')).toEqual([
		'Looking around',
		'⏺ Bash(pnpm test)',
	])
})

test('describeCall should show the main argument, collapse whitespace and drop the mcp prefix', () => {
	expect(describeCall('Read', { file_path: 'src/app.ts' })).toBe(
		'⏺ Read(src/app.ts)'
	)
	expect(describeCall('Bash', { command: 'pnpm\n  test' })).toBe(
		'⏺ Bash(pnpm test)'
	)
	expect(describeCall('mcp__jscpd__get_statistics', {})).toBe(
		'⏺ jscpd__get_statistics'
	)
})

test('addRow should ignore an agent it already knows and cap the list', () => {
	const base = {
		type: 'Explore',
		description: 'Find usages',
		status: 'running',
		startedAt: 0,
	}
	const once = addRow([], { ...base, id: 'agent-1' })

	expect(addRow(once, { ...base, id: 'agent-1' })).toBe(once)

	const many = Array.from(
		{ length: MAX_AGENTS + 3 },
		(_, i) => `agent-${i}`
	).reduce((rows, id) => addRow(rows, { ...base, id }), once.slice(0, 0))
	expect(many).toHaveLength(MAX_AGENTS)
	expect(many.at(-1)?.id).toBe(`agent-${MAX_AGENTS + 2}`)
})
