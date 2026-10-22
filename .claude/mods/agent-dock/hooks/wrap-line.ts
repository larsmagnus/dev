/** Breaks a line into rows of at most `columns`: at spaces where it can, mid-word where a word is wider than a row; leading indent is kept. */
export const wrapLine = (line: string, columns: number) => {
	const width = Math.max(1, columns)
	const indent = /^ */.exec(line)?.[0] ?? ''
	const rows: string[] = []
	let current = indent
	let hasWord = false
	for (const word of line.slice(indent.length).split(' ')) {
		const joined = hasWord ? `${current} ${word}` : `${current}${word}`
		if (joined.length <= width) {
			current = joined
			hasWord = true
			continue
		}

		let rest = hasWord ? word : joined
		if (hasWord) rows.push(current)
		while (rest.length > width) {
			rows.push(rest.slice(0, width))
			rest = rest.slice(width)
		}
		current = rest
		hasWord = true
	}

	return [...rows, current]
}
