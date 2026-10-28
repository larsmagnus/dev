import { expect, test } from 'claude-code/testing'

import { splitFences } from '../hooks/segments'

const FLOW = 'graph TD\n  A[Client] --> B[API gateway]\n  B --> C[(Orders DB)]'
const CELLS =
	'<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'

test('should split a mermaid fence out of the prose around it', () => {
	const fence = `\`\`\`mermaid\n${FLOW}\n\`\`\``
	const segments = splitFences(
		`Here is the request flow:\n\n${fence}\n\nThe gateway fans out.`
	)

	expect(segments).toEqual([
		{ kind: 'text', text: 'Here is the request flow:\n\n' },
		{
			kind: 'diagram',
			language: 'mermaid',
			source: FLOW,
			fence,
			hash: expect.stringMatching(/^[0-9a-f]{8}$/),
		},
		{ kind: 'text', text: '\n\nThe gateway fans out.' },
	])
})

test('should split a drawio fence out of the prose around it', () => {
	const fence = `\`\`\`drawio\n${CELLS}\n\`\`\``
	const segments = splitFences(`Network layout:\n${fence}\nDone.`)

	expect(segments).toMatchObject([
		{ kind: 'text', text: 'Network layout:\n' },
		{ kind: 'diagram', language: 'drawio', source: CELLS, fence },
		{ kind: 'text', text: '\nDone.' },
	])
})

test('should leave an unclosed fence as prose while it streams', () => {
	const text = `Drawing it now:\n\`\`\`mermaid\n${FLOW}`

	expect(splitFences(text)).toEqual([{ kind: 'text', text }])
})

test('should ignore fences of other languages', () => {
	const text =
		'```ts\nconst orderId = "ord-12345"\n```\n\n```json\n{ "ok": true }\n```'

	expect(splitFences(text)).toEqual([{ kind: 'text', text }])
})

test('should give identical diagrams equal hashes and different ones different hashes', () => {
	const [first, second, other] = splitFences(
		`\`\`\`mermaid\n${FLOW}\n\`\`\`\n\`\`\`mermaid\n${FLOW}\n\`\`\`\n\`\`\`mermaid\ngraph LR\n  A --> B\n\`\`\``
	).filter((segment) => segment.kind === 'diagram')

	expect(first?.hash).toBe(second?.hash)
	expect(first?.hash).not.toBe(other?.hash)
})

test('should return no segments for an empty reply', () => {
	expect(splitFences('')).toEqual([])
})
