import { expect, test } from 'claude-code/testing'

import {
	addRow,
	describeCall,
	MAX_AGENTS,
	withActivity,
} from '../hooks/activity'
import { formatElapsed, formatTokens, frontmatterColor } from '../hooks/format'

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

const colorNames = {
	red: '#e06c75',
	blue: '#61afef',
	green: '#98c379',
	yellow: '#e5c07b',
	purple: '#c678dd',
	orange: '#d19a66',
	pink: '#f78fb3',
	cyan: '#56b6c2',
} as const

for (const [name, hex] of Object.entries(colorNames)) {
	test(`frontmatterColor should read the name ${name} as ${hex}`, () => {
		const markdown = `---\nname: code-reviewer\ncolor: ${name}\n---\nReview the diff.`

		expect(frontmatterColor(markdown)).toBe(hex)
	})
}

test('frontmatterColor should read a #rrggbb value, quoted or not, in any case', () => {
	expect(frontmatterColor('---\ncolor: #FF8800\n---\n')).toBe('#ff8800')
	expect(frontmatterColor('---\ncolor: "#ff8800"\n---\n')).toBe('#ff8800')
	expect(frontmatterColor("---\ncolor: '#ff8800'\n---\n")).toBe('#ff8800')
})

test('frontmatterColor should read a colour name in any case and with CRLF line ends', () => {
	expect(frontmatterColor('---\r\ncolor: Green\r\n---\r\nBody')).toBe('#98c379')
})

test('frontmatterColor should return nothing for an unknown name, a short hex or no colour line', () => {
	expect(frontmatterColor('---\ncolor: chartreuse\n---\n')).toBeUndefined()
	expect(frontmatterColor('---\ncolor: #f80\n---\n')).toBeUndefined()
	expect(frontmatterColor('---\nname: code-reviewer\n---\n')).toBeUndefined()
})

test('frontmatterColor should ignore a colour line outside the frontmatter', () => {
	expect(frontmatterColor('# Notes\ncolor: red\n')).toBeUndefined()
	expect(frontmatterColor('---\nname: x\n---\ncolor: red\n')).toBeUndefined()
})

test('formatTokens should show plain counts below 1000, then k, then m', () => {
	expect(formatTokens(0)).toBe('0')
	expect(formatTokens(842)).toBe('842')
	expect(formatTokens(999)).toBe('999')
	expect(formatTokens(1000)).toBe('1k')
	expect(formatTokens(12_400)).toBe('12.4k')
	expect(formatTokens(150_000)).toBe('150k')
	expect(formatTokens(1_000_000)).toBe('1m')
	expect(formatTokens(1_200_000)).toBe('1.2m')
})
