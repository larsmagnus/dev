// Usage: npx tsx taxonomy-checker.ts <content-dir> [fields=category,type,tags]
// Extracts values for taxonomy fields and flags inconsistencies.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const CONTENT_DIR = process.argv[2]
const FIELDS = (process.argv[3] || 'category,type,tags').split(',')

// Use find to get all content files
const files = execSync(`find ${CONTENT_DIR} -name "*.mdx" -o -name "*.md"`, {
	encoding: 'utf-8',
})
	.trim()
	.split('\n')
	.filter(Boolean)

const taxonomy: Record<string, Record<string, string[]>> = {}

for (const file of files) {
	const content = readFileSync(file, 'utf-8')
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)

	if (!fmMatch) continue

	for (const field of FIELDS) {
		const fieldMatch = fmMatch[1].match(new RegExp(`^${field}:\\s*(.+)`, 'm'))

		if (!fieldMatch) continue

		const value = fieldMatch[1].trim()
		const normalized = value.toLowerCase().replace(/s$/, '')

		if (!taxonomy[field]) {
			taxonomy[field] = {}
		}

		if (!taxonomy[field][normalized]) {
			taxonomy[field][normalized] = []
		}

		taxonomy[field][normalized].push(`${value} (${file})`)
	}
}

// Flag inconsistencies: same normalized value with different original values
for (const [field, values] of Object.entries(taxonomy)) {
	for (const [, occurrences] of Object.entries(values)) {
		const unique = [...new Set(occurrences.map((o) => o.split(' (')[0]))]

		if (unique.length > 1) {
			console.log(`INCONSISTENCY in "${field}": ${unique.join(' vs ')}`)

			for (const o of occurrences) console.log(`  ${o}`)
		}
	}
}
