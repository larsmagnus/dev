import type { DockElements } from './elements'

const PATH_OR_URL =
	/https?:\/\/[^\s)>"'`]+|(?<![\w/:.])\/(?:[\w.@+-]+\/)*[\w.@+-]+/g

/** Splits a row's text into plain runs and clickable ones: URLs, and absolute paths as file links so a task can open the full instructions it points to. */
export const linkified = (ui: DockElements, text: string) => {
	const { Link } = ui
	const parts: (string | ReturnType<typeof Link>)[] = []
	let last = 0
	for (const match of text.matchAll(PATH_OR_URL)) {
		const end = match.index + match[0].length
		// A path cut by the Task clip would open the wrong file.
		if (text[end] === '…') continue

		parts.push(text.slice(last, match.index))
		const href = match[0].startsWith('/')
			? encodeURI(`file://${match[0]}`)
			: match[0]
		parts.push(<Link key={`${match.index}`} href={href} label={match[0]} />)
		last = end
	}

	return [...parts, text.slice(last)]
}
