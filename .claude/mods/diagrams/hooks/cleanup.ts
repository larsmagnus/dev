import type { EngineInterface } from 'claude-code'

const STALE_PROFILE_DAYS = 1
const STALE_PICTURE_DAYS = 30

/** Deletes what past sessions left in the cache folder: each session's Chrome profile once a day idle, drawn pictures after a month. Never rejects, as nothing awaits it. */
export async function cleanCache($: EngineInterface, cacheDir: string) {
	/** Deletes the cache entries matching `pattern` that were last changed more than `days` ago. */
	const sweep = (pattern: string, days: number) =>
		$.process
			.run([
				'find',
				cacheDir,
				'-maxdepth',
				'1',
				'-name',
				pattern,
				'-mtime',
				`+${days}`,
				'-exec',
				'rm',
				'-rf',
				'{}',
				'+',
			])
			.catch(() => undefined)

	await Promise.all([
		sweep('profile-*', STALE_PROFILE_DAYS),
		sweep('*.png', STALE_PICTURE_DAYS),
	])
}
