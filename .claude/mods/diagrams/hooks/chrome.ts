import type { EngineInterface } from 'claude-code'

import { fileUrl } from './page'

/** Device pixels the picture holds per layout pixel. The terminal scales it down to the same cells, so a higher value only sharpens it. */
const PICTURE_SCALE = 2

const BROWSERS = [
	'Google Chrome',
	'Chromium',
	'Brave Browser',
	'Microsoft Edge',
].map((app) => `/Applications/${app}.app/Contents/MacOS/${app}`)

/** Whether a file exists. */
export function exists($: EngineInterface, path: string) {
	return $.fs.stat(path).then(
		() => true,
		() => false
	)
}

/** Screenshots a page to `file` in a window of exactly `size`. Rejects when Chrome fails or writes nothing. */
export async function screenshot(
	$: EngineInterface,
	{
		chrome,
		flags,
		size,
		pagePath,
		file,
	}: {
		chrome: string
		flags: string[]
		size: { width: number; height: number }
		pagePath: string
		file: string
	}
) {
	await $.process.run(['rm', '-f', file])
	const shot = await $.process.run(
		[
			chrome,
			...flags,
			`--force-device-scale-factor=${PICTURE_SCALE}`,
			`--window-size=${size.width},${size.height}`,
			`--screenshot=${file}`,
			fileUrl(pagePath),
		],
		{ timeoutMs: 60_000 }
	)
	if (shot.exitCode !== 0 || !(await exists($, file)))
		throw new Error('screenshot failed')
}

/** The configured browser, else the first Chromium-based one installed; undefined when there is none. */
export async function findChrome($: EngineInterface, configured: string) {
	if (configured !== '') return configured

	const installed = await Promise.all(BROWSERS.map((path) => exists($, path)))
	return BROWSERS.find((_, i) => installed[i])
}
