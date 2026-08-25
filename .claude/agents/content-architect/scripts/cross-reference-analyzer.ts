// Usage: npx tsx cross-reference-analyzer.ts <content-dir>
// Finds internal links between content files and identifies orphans.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

const CONTENT_DIR = process.argv[2]
const files = execSync(`find ${CONTENT_DIR} -name "*.mdx" -o -name "*.md"`, {
	encoding: 'utf-8',
})
	.trim()
	.split('\n')
	.filter(Boolean)

const incomingLinks: Record<string, string[]> = {}
const outgoingLinks: Record<string, string[]> = {}

for (const file of files) {
	const rel = relative(CONTENT_DIR, file)
	incomingLinks[rel] = incomingLinks[rel] || []
	outgoingLinks[rel] = []

	const content = readFileSync(file, 'utf-8')
	// Match markdown links, MDX imports, and href attributes
	const linkPatterns = [
		/\[.*?\]\(([^)]+)\)/g, // [text](link)
		/href="([^"]+)"/g, // href="link"
		/import.*from\s+["']([^"']+)/g, // import from "path"
	]

	for (const pattern of linkPatterns) {
		let match
		while ((match = pattern.exec(content)) !== null) {
			const link = match[1]

			if (link.startsWith('http') || link.startsWith('#')) continue

			outgoingLinks[rel].push(link)
		}
	}
}

// Identify orphans (no incoming links, not an index file)
const orphans = Object.entries(incomingLinks)
	.filter(
		([file, links]) =>
			links.length === 0 &&
			!file.endsWith('index.mdx') &&
			!file.endsWith('index.md')
	)
	.map(([file]) => file)

console.log(
	JSON.stringify(
		{ totalFiles: files.length, orphans, orphanCount: orphans.length },
		null,
		2
	)
)
