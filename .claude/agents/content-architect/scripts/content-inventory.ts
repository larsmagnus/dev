// Usage: npx tsx content-inventory.ts <content-dir>
// Extracts frontmatter from content files and outputs a condensed JSON summary.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const CONTENT_DIR = process.argv[2]
if (!CONTENT_DIR) {
	console.error('Usage: npx tsx content-inventory.ts <content-dir>')
	process.exit(1)
}

interface ContentItem {
	path: string
	fields: Record<string, string>
	wordCount: number
}

function extractFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/)

	if (!match) return {}

	const fields: Record<string, string> = {}

	for (const line of match[1].split('\n')) {
		const [key, ...rest] = line.split(':')

		if (key && rest.length) {
			fields[key.trim()] = rest.join(':').trim()
		}
	}

	return fields
}

function walk(dir: string): string[] {
	const files: string[] = []

	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)

		if (statSync(full).isDirectory()) {
			files.push(...walk(full))
		} else if (/\.(mdx?|yaml|yml)$/.test(entry)) {
			files.push(full)
		}
	}

	return files
}

const items: ContentItem[] = walk(CONTENT_DIR).map((file) => {
	const content = readFileSync(file, 'utf-8')
	const body = content.replace(/^---[\s\S]*?---/, '')

	return {
		path: relative(CONTENT_DIR, file),
		fields: extractFrontmatter(content),
		wordCount: body.split(/\s+/).filter(Boolean).length,
	}
})

// Summary by directory
const byDir: Record<string, number> = {}
for (const item of items) {
	const dir = item.path.split('/').slice(0, -1).join('/') || '.'
	byDir[dir] = (byDir[dir] || 0) + 1
}

// Field coverage
const fieldCounts: Record<string, number> = {}
for (const item of items) {
	for (const key of Object.keys(item.fields)) {
		fieldCounts[key] = (fieldCounts[key] || 0) + 1
	}
}

console.log(
	JSON.stringify(
		{
			totalFiles: items.length,
			byDirectory: byDir,
			fieldCoverage: fieldCounts,
			items,
		},
		null,
		2
	)
)
