// The names an agent file's `color:` frontmatter takes.
const NAMED_COLORS: Record<string, string> = {
	red: '#e06c75',
	blue: '#61afef',
	green: '#98c379',
	yellow: '#e5c07b',
	purple: '#c678dd',
	orange: '#d19a66',
	pink: '#f78fb3',
	cyan: '#56b6c2',
}
const STATUS_COLORS: Record<string, string> = {
	running: '#61afef',
	waiting: '#e5c07b',
	idle: '#e5c07b',
	completed: '#98c379',
	failed: '#e06c75',
	killed: '#d19a66',
}

/** The color an agent file's frontmatter names, as a hex value; named colors and `#rrggbb` are understood. */
export const frontmatterColor = (markdown: string) => {
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? ''
	const value = /^color:\s*["']?([^"'\s]+)/m
		.exec(frontmatter)?.[1]
		?.toLowerCase()

	return value && /^#[0-9a-f]{6}$/.test(value)
		? value
		: NAMED_COLORS[value ?? '']
}

/** The color a status is shown in; a status nobody gave one stays uncolored. */
export const statusColor = (status: string) => STATUS_COLORS[status]

/** Formats a token count as `842`, `12.4k` or `1.2m`. */
export const formatTokens = (tokens: number) => {
	if (tokens < 1000) return String(tokens)
	if (tokens < 1_000_000)
		return `${(tokens / 1000).toFixed(1).replace(/\.0$/, '')}k`

	return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
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
