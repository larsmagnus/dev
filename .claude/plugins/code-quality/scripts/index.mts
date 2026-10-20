/**
 * Claude Code code-quality hook (PostToolUse)
 * Runs format, then complexity and duplication, on each edit.
 *
 * Claude Code runs every matching hook in parallel, so as separate hooks the
 * analysers would read the file before format finished rewriting it. One entry
 * point keeps format first. The analysers only read, so they run side by side.
 *
 * Exit code 2 surfaces stderr to Claude, any other non-zero code to the user;
 * the strongest code across the steps wins and every step's message is kept.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ANALYSER_STEPS = ['complexity', 'duplication']
const BLOCKING_EXIT_CODE = 2

type StepResult = { status: number; stderr: string }

const payload = readFileSync(0, 'utf-8')

function runStep(step: string): Promise<StepResult> {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [
			'--no-warnings',
			join(import.meta.dirname, `${step}.mts`),
		])
		let stderr = ''
		child.stderr.on('data', (chunk) => (stderr += chunk))
		child.stdin.on('error', () => {})
		child.on('error', () => resolve({ status: 1, stderr }))
		child.on('close', (status) => resolve({ status: status ?? 1, stderr }))
		child.stdin.end(payload)
	})
}

const results = [
	await runStep('format'),
	...(await Promise.all(ANALYSER_STEPS.map(runStep))),
]

const messages = results.map(({ stderr }) => stderr.trim()).filter(Boolean)
if (messages.length > 0) console.error(messages.join('\n\n'))

const codes = results.map(({ status }) => status)
process.exit(
	codes.includes(BLOCKING_EXIT_CODE) ? BLOCKING_EXIT_CODE : Math.max(...codes)
)
