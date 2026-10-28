import type { EngineInterface } from 'claude-code'

import type { Attachment } from '../types'

import { parseSize, sizeArgv, thumbArgv } from './sips'

/** Runs a host command, treating one that cannot start (no `sips` off macOS) as a failed run. */
export function tryRun($: EngineInterface, argv: string[], stdin?: string) {
	return $.process
		.run(argv, { stdin })
		.catch(() => ({ exitCode: -1, stdout: '' }))
}

/** Opens a file in its default app, or reveals it in Finder when no app takes it. */
export async function openOrReveal($: EngineInterface, path: string) {
	const opened = await tryRun($, ['open', path])
	if (opened.exitCode !== 0) await tryRun($, ['open', '-R', path])
}

/** Writes a file's thumbnail and, for a picture, measures it. Resolves what it learned, since a failed step simply leaves its fact out. */
export async function measure(
	$: EngineInterface,
	{ path, mediaType }: Pick<Attachment, 'path' | 'mediaType'>,
	thumbPath: string
): Promise<Partial<Attachment>> {
	const [sized, thumbed] = await Promise.all([
		mediaType.startsWith('image/') ? tryRun($, sizeArgv(path)) : undefined,
		tryRun($, thumbArgv(path, thumbPath)),
	])

	return {
		...(sized && parseSize(sized.stdout)),
		...(thumbed.exitCode === 0 && { thumbPath }),
	}
}
