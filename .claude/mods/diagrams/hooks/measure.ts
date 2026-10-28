import type { EngineInterface } from 'claude-code'

import { fileUrl } from './page'

const SIZE = /data-size="(\d+)x(\d+)"/
const MEASURE_ATTEMPTS = 3
const MEASURE_WINDOW = '--window-size=1600,1200'

/** Reads the drawn size Chrome's page reports, retrying while there is none, since Chrome sometimes dumps before its page has finished drawing. Rejects when the diagram does not draw. */
export async function measure(
	$: EngineInterface,
	chrome: string,
	flags: string[],
	pagePath: string,
	attemptsLeft = MEASURE_ATTEMPTS
): Promise<{ width: number; height: number }> {
	const { stdout } = await $.process.run(
		[chrome, ...flags, MEASURE_WINDOW, '--dump-dom', fileUrl(pagePath)],
		{ timeoutMs: 60_000 }
	)
	const size = SIZE.exec(stdout)
	if (size) return { width: Number(size[1]), height: Number(size[2]) }
	if (attemptsLeft <= 1 || stdout.includes('data-failed'))
		throw new Error('diagram did not draw')

	return measure($, chrome, flags, pagePath, attemptsLeft - 1)
}
