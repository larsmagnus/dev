import type { AgentRow } from '../types'

const COLORS = [
	'#61afef',
	'#c678dd',
	'#98c379',
	'#e5c07b',
	'#56b6c2',
	'#e06c75',
	'#d19a66',
	'#a9b1d6',
]
const ARG_KEYS = [
	'description',
	'command',
	'file_path',
	'pattern',
	'path',
	'url',
	'query',
	'skill',
	'prompt',
]

export const MAX_AGENTS = 100
export const FINISHED = new Set(['completed', 'failed', 'killed'])
export const TOOL_MARK = '⏺ '

/** Collapses whitespace so a multi-line value fits one row. */
export const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Heads a tool call as the main transcript does: `⏺ Tool(main argument)`. */
export const describeCall = (tool: string, fields: object) => {
	const values = new Map<string, unknown>(Object.entries(fields))
	const arg = ARG_KEYS.map((key) => values.get(key)).find(
		(value): value is string => typeof value === 'string' && value !== ''
	)

	return `${TOOL_MARK}${tool.replace(/^mcp__/, '')}${arg ? `(${oneLine(arg)})` : ''}`
}

/** Formats milliseconds as `42s`, `3m 07s` or `1h 02m`. */
export const formatElapsed = (ms: number) => {
	const seconds = Math.max(0, Math.floor(ms / 1000))
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60)
		return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`

	return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** Keeps the two newest activity lines; streamed text replaces its own previous line instead of stacking. */
export const withActivity = (recent: string[], line: string) => {
	const last = recent.at(-1)
	const replacesText =
		!line.startsWith(TOOL_MARK) &&
		last !== undefined &&
		!last.startsWith(TOOL_MARK)

	return [...(replacesText ? recent.slice(0, -1) : recent), line].slice(-2)
}

/** Adds an agent the dock has not seen, colored by arrival order. */
export const addRow = (
	rows: AgentRow[],
	row: Pick<AgentRow, 'id' | 'type' | 'description' | 'status' | 'startedAt'>
) =>
	rows.some((known) => known.id === row.id)
		? rows
		: [
				...rows,
				{
					...row,
					color: COLORS[rows.length % COLORS.length] ?? '#61afef',
					recent: [],
				},
			].slice(-MAX_AGENTS)
