import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { isRecord } from '../hooks/parse.ts'

import { HOME, STORE } from './store.ts'

const run = promisify(execFile)

const PROMPTS = fileURLToPath(new URL('../prompts/', import.meta.url))

/** Runs a headless Claude with the given instructions and returns its schema-validated output. */
export async function ask(options: {
	promptFile: string
	prompt: string
	schema: object
	tools: string[]
	permissionMode: 'dontAsk' | 'acceptEdits'
	model: string
	budgetUsd: number
	addDirs: string[]
	timeoutMs: number
}): Promise<unknown> {
	const instructions = await readFile(join(PROMPTS, options.promptFile), 'utf8')
	const { stdout } = await run(
		'claude',
		[
			'-p',
			options.prompt,
			'--append-system-prompt',
			instructions,
			'--output-format',
			'json',
			'--json-schema',
			JSON.stringify(options.schema),
			'--model',
			options.model,
			'--permission-mode',
			options.permissionMode,
			'--allowedTools',
			options.tools.join(','),
			'--add-dir',
			join(HOME, '.claude'),
			...options.addDirs.flatMap((dir) => ['--add-dir', dir]),
			'--max-budget-usd',
			String(options.budgetUsd),
		],
		{ cwd: STORE, maxBuffer: 64 * 1024 * 1024, timeout: options.timeoutMs }
	)
	const reply: unknown = JSON.parse(stdout)
	if (!isRecord(reply) || reply.is_error === true)
		throw new Error(`claude failed: ${stdout.slice(0, 500)}`)

	return reply.structured_output
}
