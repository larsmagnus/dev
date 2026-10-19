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
// Indented so a diff line can never be mistaken for prose, which is trimmed to one line.
export const DIFF_REMOVED = '  - '
export const DIFF_ADDED = '  + '

const MAX_DIFF_LINES = 10

const MAX_TITLE_CHARS = 60

/** Cuts a title to one short line, so a long shell command never spills over the rows around it. */
const clipTitle = (title: string) =>
	title.length > MAX_TITLE_CHARS
		? `${title.slice(0, MAX_TITLE_CHARS - 1)}…`
		: title

export const SHELL_TITLE = 'shell'

/** The title a row is listed under: a shell is always `shell`, whatever title it was stored with, and any other row its agent type. */
export const rowTitle = (row: Pick<AgentRow, 'kind' | 'type'>) =>
	row.kind === 'shell' ? SHELL_TITLE : clipTitle(row.type)

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

const field = (value: unknown, key: string): unknown =>
	typeof value === 'object' && value !== null
		? new Map(Object.entries(value)).get(key)
		: undefined

const diffSide = (prefix: string, text: unknown) => {
	if (typeof text !== 'string' || text === '') return []
	const lines = text.split('\n')
	const shown = lines.slice(0, MAX_DIFF_LINES).map((line) => prefix + line)

	return lines.length > MAX_DIFF_LINES ? [...shown, `${prefix}…`] : shown
}

/** Shows what an Edit or MultiEdit replaced and with what, as removed then added lines under each change. */
export const describeEdits = (tool: string, input: unknown) => {
	if (tool !== 'Edit' && tool !== 'MultiEdit') return []
	const edits = tool === 'Edit' ? [input] : field(input, 'edits')
	if (!Array.isArray(edits)) return []

	return edits.flatMap((edit) => [
		...diffSide(DIFF_REMOVED, field(edit, 'old_string')),
		...diffSide(DIFF_ADDED, field(edit, 'new_string')),
	])
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
	row: Pick<AgentRow, 'id' | 'type' | 'description' | 'status' | 'startedAt'> &
		Partial<Pick<AgentRow, 'kind' | 'prompt' | 'command' | 'color' | 'ownerId'>>
) =>
	rows.some((known) => known.id === row.id)
		? rows
		: [
				...rows,
				{
					...row,
					color: row.color ?? COLORS[rows.length % COLORS.length] ?? '#61afef',
					recent: [],
				},
			].slice(-MAX_AGENTS)
