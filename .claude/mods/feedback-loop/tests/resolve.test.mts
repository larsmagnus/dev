// oxlint-disable typescript/no-floating-promises
import assert from 'node:assert/strict'
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, beforeEach, describe, it } from 'node:test'

import { parseSuggestions } from '../hooks/parse.ts'
import type { Suggestion } from '../types'

type Edit = { file: string; find: string; replace: string }
type Result = {
	key: string
	outcome: 'applied' | 'skipped'
	note: string
	edits: Edit[]
}

// Stands in for the headless applier: replays the reply the test queued.
const fakeClaude = `#!/bin/sh
cat "$FAKE_CLAUDE_REPLY"
`

let sandbox: string
let home: string
let project: string
let replyFile: string
let resolveSelection: typeof import('../scripts/resolve.ts').resolveSelection
let parseResolution: typeof import('../scripts/resolve.ts').parseResolution

before(async () => {
	sandbox = mkdtempSync(join(tmpdir(), 'feedback-loop-resolve-'))
	home = join(sandbox, 'home')
	mkdirSync(join(sandbox, 'bin'))
	mkdirSync(join(home, '.claude', 'feedback-loop'), { recursive: true })
	writeFileSync(join(sandbox, 'bin', 'claude'), fakeClaude, { mode: 0o755 })

	// store.ts reads HOME at import, so these must be set first.
	process.env.HOME = home
	process.env.PATH = `${join(sandbox, 'bin')}:${process.env.PATH}`
	replyFile = join(sandbox, 'reply.json')
	process.env.FAKE_CLAUDE_REPLY = replyFile
	;({ resolveSelection, parseResolution } =
		await import('../scripts/resolve.ts'))
})

after(() => rmSync(sandbox, { recursive: true, force: true }))

beforeEach(() => {
	project = mkdtempSync(join(sandbox, 'punchdown-'))
})

const suggestion = (key: string): Suggestion => ({
	key,
	project,
	track: 'context',
	type: '~/.claude/CLAUDE.md',
	finding: `Finding for ${key}`,
	action: `Persist ${key}`,
	evidence: ['session-123 quote'],
	status: 'pending',
	firstSeen: 1,
	lastSeen: 1,
	seenCount: 1,
})

const seedLedger = (...keys: string[]) =>
	writeFileSync(
		join(home, '.claude', 'feedback-loop', 'suggestions.jsonl'),
		keys.map((key) => JSON.stringify(suggestion(key))).join('\n') + '\n'
	)

const modelReplies = (...results: Result[]) =>
	writeFileSync(replyFile, JSON.stringify({ structured_output: { results } }))

const statusOf = (key: string) =>
	parseSuggestions(
		readFileSync(
			join(home, '.claude', 'feedback-loop', 'suggestions.jsonl'),
			'utf8'
		)
	).find((s) => s.key === key)?.status

const apply = (...keys: string[]) =>
	resolveSelection({ apply: keys, decline: [], correction: '' })

describe('resolveSelection applying edits', () => {
	it('should write the edit to the file and mark the suggestion applied', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules\n- Be terse\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added verification rule',
			edits: [
				{
					file: claudeMd,
					find: '- Be terse\n',
					replace: '- Be terse\n- Verify before claiming\n',
				},
			],
		})

		const summary = await apply('verify-before-claiming')

		assert.equal(
			readFileSync(claudeMd, 'utf8'),
			'# Rules\n- Be terse\n- Verify before claiming\n'
		)
		assert.equal(statusOf('verify-before-claiming'), 'applied')
		assert.match(summary, /1 applied, 0 not applied, 0 declined/)
		assert.match(summary, /\+ verify-before-claiming: Added verification rule/)
	})

	it('should append to the file when find is empty', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules\n')
		seedLedger('read-before-edit')
		modelReplies({
			key: 'read-before-edit',
			outcome: 'applied',
			note: 'Appended rule',
			edits: [{ file: claudeMd, find: '', replace: '- Read before edit\n' }],
		})

		await apply('read-before-edit')

		assert.equal(
			readFileSync(claudeMd, 'utf8'),
			'# Rules\n- Read before edit\n'
		)
		assert.equal(statusOf('read-before-edit'), 'applied')
	})

	it('should put the appended text on its own line when the file lacks a trailing newline', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules')
		seedLedger('read-before-edit')
		modelReplies({
			key: 'read-before-edit',
			outcome: 'applied',
			note: 'Appended rule',
			edits: [{ file: claudeMd, find: '', replace: '- Read before edit\n' }],
		})

		await apply('read-before-edit')

		assert.equal(
			readFileSync(claudeMd, 'utf8'),
			'# Rules\n- Read before edit\n'
		)
	})

	it('should accept a file whose name starts with two dots', async () => {
		const notes = join(project, '..notes.md')
		writeFileSync(notes, '# Notes\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added',
			edits: [{ file: notes, find: '', replace: '- Verify\n' }],
		})

		await apply('verify-before-claiming')

		assert.equal(readFileSync(notes, 'utf8'), '# Notes\n- Verify\n')
		assert.equal(statusOf('verify-before-claiming'), 'applied')
	})

	it('should land both edits in order when two suggestions edit the same file', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules\n')
		seedLedger('verify-before-claiming', 'read-before-edit')
		modelReplies(
			{
				key: 'verify-before-claiming',
				outcome: 'applied',
				note: 'first',
				edits: [
					{ file: claudeMd, find: '# Rules\n', replace: '# Rules\n- A\n' },
				],
			},
			{
				key: 'read-before-edit',
				outcome: 'applied',
				note: 'second',
				edits: [{ file: claudeMd, find: '- A\n', replace: '- A\n- B\n' }],
			}
		)

		await apply('verify-before-claiming', 'read-before-edit')

		assert.equal(readFileSync(claudeMd, 'utf8'), '# Rules\n- A\n- B\n')
		assert.equal(statusOf('verify-before-claiming'), 'applied')
		assert.equal(statusOf('read-before-edit'), 'applied')
	})

	it('should write files under ~/.claude', async () => {
		const globalMd = join(home, '.claude', 'CLAUDE.md')
		writeFileSync(globalMd, '# Global\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added',
			edits: [{ file: globalMd, find: '', replace: '- Verify\n' }],
		})

		await apply('verify-before-claiming')

		assert.equal(readFileSync(globalMd, 'utf8'), '# Global\n- Verify\n')
		assert.equal(statusOf('verify-before-claiming'), 'applied')
	})
})

describe('resolveSelection when an edit cannot be written', () => {
	for (const [label, text, count] of [
		['not found', '# Rules\n', 0],
		['ambiguous', '- Be terse\n- Be terse\n', 2],
	] as const) {
		it(`should skip and leave the file untouched when find is ${label} (${count}x)`, async () => {
			const claudeMd = join(project, 'CLAUDE.md')
			writeFileSync(claudeMd, text)
			seedLedger('verify-before-claiming')
			modelReplies({
				key: 'verify-before-claiming',
				outcome: 'applied',
				note: 'Added',
				edits: [
					{ file: claudeMd, find: '- Be terse\n', replace: '- Be brief\n' },
				],
			})

			const summary = await apply('verify-before-claiming')

			assert.equal(readFileSync(claudeMd, 'utf8'), text)
			assert.equal(statusOf('verify-before-claiming'), 'pending')
			assert.match(summary, /x verify-before-claiming: write failed: /)
			assert.match(summary, new RegExp(`matches ${count}x`))
		})
	}

	it('should not run a later edit of the same suggestion after one fails', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added',
			edits: [
				{ file: claudeMd, find: 'missing text', replace: 'x' },
				{ file: claudeMd, find: '', replace: '- Verify\n' },
			],
		})

		await apply('verify-before-claiming')

		assert.equal(readFileSync(claudeMd, 'utf8'), '# Rules\n')
		assert.equal(statusOf('verify-before-claiming'), 'pending')
	})

	it('should skip and not write a file outside the project and ~/.claude', async () => {
		const outside = join(sandbox, 'elsewhere.md')
		writeFileSync(outside, '# Other\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added',
			edits: [{ file: outside, find: '', replace: '- Verify\n' }],
		})

		const summary = await apply('verify-before-claiming')

		assert.equal(readFileSync(outside, 'utf8'), '# Other\n')
		assert.equal(statusOf('verify-before-claiming'), 'pending')
		assert.match(summary, /write failed: .* is outside the project/)
	})

	it('should leave every file untouched when the second edit of a suggestion fails', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added',
			edits: [
				{ file: claudeMd, find: '', replace: '- Verify\n' },
				{ file: claudeMd, find: 'missing text', replace: 'x' },
			],
		})

		const summary = await apply('verify-before-claiming')

		assert.equal(readFileSync(claudeMd, 'utf8'), '# Rules\n')
		assert.equal(statusOf('verify-before-claiming'), 'pending')
		assert.match(summary, /x verify-before-claiming: write failed: /)
	})

	it('should skip a symlink inside the project that points outside it', async () => {
		const outside = join(sandbox, 'elsewhere.md')
		const link = join(project, 'CLAUDE.md')
		writeFileSync(outside, '# Other\n')
		symlinkSync(outside, link)
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added',
			edits: [{ file: link, find: '', replace: '- Verify\n' }],
		})

		const summary = await apply('verify-before-claiming')

		assert.equal(readFileSync(outside, 'utf8'), '# Other\n')
		assert.equal(statusOf('verify-before-claiming'), 'pending')
		assert.match(summary, /write failed: .* is outside the project/)
	})

	it('should skip a path that climbs out of the project with ..', async () => {
		const outside = join(sandbox, 'elsewhere.md')
		writeFileSync(outside, '# Other\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Added',
			edits: [
				{
					file: join(project, '..', 'elsewhere.md'),
					find: '',
					replace: '- Verify\n',
				},
			],
		})

		await apply('verify-before-claiming')

		assert.equal(readFileSync(outside, 'utf8'), '# Other\n')
		assert.equal(statusOf('verify-before-claiming'), 'pending')
	})
})

describe('resolveSelection model outcomes', () => {
	it('should write nothing when the model skips a suggestion', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules\n')
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'skipped',
			note: 'Already covered',
			edits: [{ file: claudeMd, find: '', replace: '- Verify\n' }],
		})

		const summary = await apply('verify-before-claiming')

		assert.equal(readFileSync(claudeMd, 'utf8'), '# Rules\n')
		assert.equal(statusOf('verify-before-claiming'), 'pending')
		assert.match(summary, /x verify-before-claiming: Already covered/)
	})

	it('should report not applied when the model claims applied with no edits', async () => {
		seedLedger('verify-before-claiming')
		modelReplies({
			key: 'verify-before-claiming',
			outcome: 'applied',
			note: 'Done',
			edits: [],
		})

		const summary = await apply('verify-before-claiming')

		assert.equal(statusOf('verify-before-claiming'), 'pending')
		assert.match(summary, /1 not applied/)
		assert.match(summary, /x verify-before-claiming: no edits proposed/)
	})

	it('should report no result for a ticked key the model never mentions', async () => {
		seedLedger('verify-before-claiming')
		modelReplies()

		const summary = await apply('verify-before-claiming')

		assert.equal(statusOf('verify-before-claiming'), 'pending')
		assert.match(summary, /x verify-before-claiming: no result reported/)
	})

	it('should ignore results for suggestions the user did not tick', async () => {
		const claudeMd = join(project, 'CLAUDE.md')
		writeFileSync(claudeMd, '# Rules\n')
		seedLedger('verify-before-claiming', 'read-before-edit')
		modelReplies({
			key: 'read-before-edit',
			outcome: 'applied',
			note: 'Added',
			edits: [{ file: claudeMd, find: '', replace: '- Read\n' }],
		})

		await apply('verify-before-claiming')

		assert.equal(readFileSync(claudeMd, 'utf8'), '# Rules\n')
		assert.equal(statusOf('read-before-edit'), 'pending')
	})

	it('should decline without asking the model when nothing is ticked to apply', async () => {
		seedLedger('verify-before-claiming')
		rmSync(replyFile, { force: true })

		const summary = await resolveSelection({
			apply: [],
			decline: ['verify-before-claiming'],
			correction: 'Too vague',
		})

		assert.equal(statusOf('verify-before-claiming'), 'declined')
		assert.match(summary, /0 applied, 0 not applied, 1 declined/)
	})
})

describe('parseResolution', () => {
	it('should return the request when it is well formed', () => {
		assert.deepEqual(
			parseResolution(
				'{"apply":["read-before-edit"],"decline":["verify-before-claiming"],"correction":"Keep it short"}'
			),
			{
				apply: ['read-before-edit'],
				decline: ['verify-before-claiming'],
				correction: 'Keep it short',
			}
		)
	})

	for (const [label, input] of [
		['apply is missing', '{"decline":[],"correction":""}'],
		['decline is missing', '{"apply":[],"correction":""}'],
		['correction is missing', '{"apply":[],"decline":[]}'],
		['apply holds a non-string', '{"apply":[1],"decline":[],"correction":""}'],
		['decline is not an array', '{"apply":[],"decline":"a","correction":""}'],
		['correction is not a string', '{"apply":[],"decline":[],"correction":2}'],
		['the value is an array', '[]'],
		['the value is null', 'null'],
	] as const) {
		it(`should reject input when ${label}`, () => {
			assert.throws(() => parseResolution(input), /resolve expects/)
		})
	}

	it('should reject input that is not JSON', () => {
		assert.throws(() => parseResolution('apply everything'), SyntaxError)
	})
})
