import { atom, read, update } from 'claude-code'
import type {
	EngineInterface,
	Register,
	RenderElement,
	UiPressArgument,
} from 'claude-code'

import type { Rendered } from '../types'

import { exists, findChrome } from './chrome'
import { cleanCache } from './cleanup'
import { diagramRow } from './image'
import { LIBRARY_FILES } from './page'
import type { Theme } from './page'
import { renderDiagram } from './render'
import { isDiagram, splitFences } from './segments'
import type { Diagram } from './segments'

const rendered = atom({ plugin: 'diagrams', key: 'rendered' } as const, {})
const showSource = atom({ plugin: 'diagrams', key: 'showSource' } as const, {})

const started = new Set<string>()
let hasWarnedMissing = false

/** Keys a picture by content and theme, since the same diagram draws differently per theme. */
const keyOf = (diagram: Diagram, theme: Theme) => `${diagram.hash}-${theme}`

/** The press that swaps one diagram between its picture and its source. */
const toggle = ($: EngineInterface, hash: string) => () =>
	update($, showSource, (shown) => ({ ...shown, [hash]: !shown[hash] }))

/** The press that puts a diagram's source, without its fence, on the clipboard. */
const copySource =
	($: EngineInterface, source: string) => async (press: UiPressArgument) => {
		const result = await $.ui.copy({ text: source, surface: press.surface })
		$.ui.toast(
			result.isCopied
				? 'diagrams: source copied'
				: `diagrams: copy failed, ${result.reason}`
		)
	}

/** The press that saves a diagram's picture to the Downloads folder. */
const download =
	($: EngineInterface, diagram: Diagram, picture: Rendered) => async () => {
		const target = `${await $.env.get('HOME')}/Downloads/${diagram.language}-${diagram.hash}.png`
		const copied = await $.process
			.run(['cp', picture.file, target])
			.catch(() => ({ exitCode: -1 }))
		$.ui.toast(
			copied.exitCode === 0
				? `diagrams: saved ${target}`
				: 'diagrams: download failed'
		)
	}

/** Where drawn pictures, Chrome profiles and the downloaded libraries live. */
async function cacheDirOf($: EngineInterface) {
	return `${await $.env.get('HOME')}/.claude/diagrams`
}

/** Draws a diagram once per session and stores the result, `null` when it failed so the source stays and no retry follows. A missing Chrome or library is warned about once and not stored, so drawing starts once it is installed. Never rejects, as nothing awaits it. */
async function drawOnce(
	$: EngineInterface,
	diagram: Diagram,
	theme: Theme,
	chromePath: string
) {
	const key = keyOf(diagram, theme)
	if (started.has(key)) return
	started.add(key)

	const cacheDir = await cacheDirOf($)
	const chrome = await findChrome($, chromePath)
	const hasLibrary = await exists(
		$,
		`${cacheDir}/library/${LIBRARY_FILES[diagram.language]}`
	)
	if (chrome === undefined || !hasLibrary) {
		if (!hasWarnedMissing) {
			hasWarnedMissing = true
			$.ui.toast(
				chrome === undefined
					? 'diagrams: no Chrome found, set chromePath in /config'
					: 'diagrams: libraries missing, run /diagrams:install'
			)
		}
		started.delete(key)
		return
	}

	/** Stores the drawn picture, or `null` for a diagram that failed. */
	const keep = (value: Awaited<ReturnType<typeof renderDiagram>> | null) =>
		update($, rendered, (all) => ({ ...all, [key]: value }))

	try {
		await keep(await renderDiagram($, { diagram, theme, chrome, cacheDir }))
	} catch (error) {
		$.ui.log(
			`diagrams: ${error instanceof Error ? error.message : String(error)}`
		)
		await keep(null)
	}
}

/** Other mods may wrap the engine's node in any order, so this swaps only that node for the drawing. */
const inEngineSlot = (
	node: RenderElement,
	drawing: RenderElement
): RenderElement => {
	if (node.type === 'engine') return drawing
	if (node.type !== 'Box') return node
	return {
		...node,
		children: node.children?.map((child) =>
			typeof child === 'string' ? child : inEngineSlot(child, drawing)
		),
	}
}

/** Replaces mermaid and drawio code blocks in a reply with pictures drawn by headless Chrome. */
export const register: Register = (on, options) => {
	const theme = options.theme === 'light' ? 'light' : 'dark'
	const chromePath =
		typeof options.chromePath === 'string' ? options.chromePath : ''

	on('session.start', async ($, e, next) => {
		$.clock.after(0, async () => cleanCache($, await cacheDirOf($)))

		return next(e)
	})

	on('ui.message', async ($, e, next) => {
		if (e.component !== 'AssistantMessage' || !e.element.startsWith('open:'))
			return next(e)

		const [, hash] = e.element.split(':')
		const picture = (await read($, rendered))[`${hash}-${theme}`]
		if (picture)
			await $.process.run(['open', picture.file]).catch(() => undefined)
		return {}
	})

	on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
		const ui = $.ui.resolve(e)
		if (e.surface !== 'terminal' || !('Image' in ui) || e.props.isSummary)
			return next(e)

		const { Box, Markdown } = ui

		const segments = splitFences(e.props.text)
		const diagrams = segments.filter(isDiagram)
		if (diagrams.length === 0) return next(e)

		const [drawn, sourceShown] = await Promise.all([
			read($, rendered),
			read($, showSource),
		])
		for (const diagram of diagrams)
			if (!started.has(keyOf(diagram, theme)))
				$.clock.after(0, () => drawOnce($, diagram, theme, chromePath))
		if (!diagrams.some((diagram) => drawn[keyOf(diagram, theme)]))
			return next(e)

		const drawing = (
			<Box flexDirection="column" marginTop={1}>
				{segments.map((segment, i) => {
					if (segment.kind === 'text')
						return <Markdown key={`text:${i}`} text={segment.text} />

					const picture = drawn[keyOf(segment, theme)]
					return picture ? (
						diagramRow(
							ui,
							segment,
							i,
							picture,
							sourceShown[segment.hash] === true,
							{
								onToggle: toggle($, segment.hash),
								onCopy: copySource($, segment.source),
								onDownload: download($, segment, picture),
							}
						)
					) : (
						<Markdown key={`diagram:${i}`} text={segment.fence} />
					)
				})}
			</Box>
		)

		return inEngineSlot(await next(e), drawing)
	})
}
