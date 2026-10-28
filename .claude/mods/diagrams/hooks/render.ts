import type { EngineInterface } from 'claude-code'

import type { Rendered } from '../types'

import { screenshot } from './chrome'
import { measure } from './measure'
import { pageHtml } from './page'
import type { Theme } from './page'
import type { Diagram } from './segments'

const FLAGS = [
	'--headless=new',
	'--disable-gpu',
	'--hide-scrollbars',
	'--allow-file-access-from-files',
	'--no-first-run',
	'--default-background-color=00000000',
	'--virtual-time-budget=10000',
]

let queue: Promise<unknown> = Promise.resolve()

/** Draws one diagram to a PNG. The page file is removed even when drawing fails. */
async function draw(
	$: EngineInterface,
	{
		diagram,
		theme,
		chrome,
		cacheDir,
	}: { diagram: Diagram; theme: Theme; chrome: string; cacheDir: string }
): Promise<Rendered> {
	const name = `${cacheDir}/${diagram.hash}-${theme}`
	const pagePath = `${name}.html`
	const file = `${name}.png`
	const flags = [
		...FLAGS,
		`--user-data-dir=${cacheDir}/profile-${await $.session.id()}`,
	]

	await $.fs.write(pagePath, pageHtml(diagram, theme, `${cacheDir}/library`))
	try {
		const size = await measure($, chrome, flags, pagePath)
		await screenshot($, { chrome, flags, size, pagePath, file })
		return { file, ...size }
	} finally {
		await $.process.run(['rm', '-f', pagePath]).catch(() => undefined)
	}
}

/** Draws a diagram to a PNG in `cacheDir`. One at a time, since Chrome locks its profile folder. Rejects when the diagram does not draw. */
export function renderDiagram(
	$: EngineInterface,
	request: Parameters<typeof draw>[1]
) {
	const result = queue.then(() => draw($, request))
	queue = result.catch(() => undefined)
	return result
}
