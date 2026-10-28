import { REPORT } from './report'
import type { Diagram } from './segments'

export type Theme = 'dark' | 'light'

const PADDING_PX = 16

/** Where each language's browser library sits in the library folder, as the install skill leaves it. */
export const LIBRARY_FILES = {
	mermaid: 'mermaid.min.js',
	drawio: 'drawio-viewer.min.js',
} as const

/** A `file://` URL that survives spaces, `#` and `?` in a path. */
export const fileUrl = (path: string) =>
	`file://${path.split('/').map(encodeURIComponent).join('/')}`

/** Escapes text for an element body. Quotes pass through, so it is not safe for attribute values. */
const escapeHtml = (text: string) =>
	text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** JSON safe to inline in a script: `<` is escaped so the source cannot close the tag. */
const inlineJson = (value: unknown) =>
	JSON.stringify(value).replaceAll('<', '\\u003c')

/** Mermaid replaces the `pre` in place, so the source is escaped into it and never parsed as HTML. */
const mermaidBody = (source: string, theme: Theme, libraryDir: string) => `
	<pre class="mermaid">${escapeHtml(source)}</pre>
	<script src="${fileUrl(`${libraryDir}/${LIBRARY_FILES.mermaid}`)}"></script>
	<script>
		${REPORT}
		mermaid.initialize({ startOnLoad: false, theme: ${inlineJson(theme === 'light' ? 'default' : theme)} })
		mermaid.run({ querySelector: '.mermaid' }).then(function () { report(document.body) }, fail)
	</script>`

/** A drawio page body. The viewer draws asynchronously, so the size is read once its SVG has settled. */
const drawioBody = (source: string, theme: Theme, libraryDir: string) => `
	<div id="graph" class="mxgraph" style="width:1600px;height:1200px"></div>
	<script>window.STYLE_PATH = window.PROXY_URL = window.SHAPES_PATH = window.STENCIL_PATH = ''</script>
	<script src="${fileUrl(`${libraryDir}/${LIBRARY_FILES.drawio}`)}"></script>
	<script>
		${REPORT}
		try {
			var graph = document.getElementById('graph')
			graph.setAttribute('data-mxgraph', JSON.stringify({ xml: ${inlineJson(source)}, toolbar: null, nav: false, resize: false, lightbox: false, 'dark-mode': ${inlineJson(theme)} }))
			GraphViewer.processElements()
			fitDrawio(graph)
		} catch (error) { fail() }
	</script>`

/** The page Chrome draws a diagram from. Both sit on a transparent ground, in the configured theme. */
export function pageHtml(diagram: Diagram, theme: Theme, libraryDir: string) {
	const isMermaid = diagram.language === 'mermaid'
	return `<!doctype html>
<html><head><meta charset="utf-8"><style>
	html, body { margin: 0; background: transparent }
	body { display: inline-block; padding: ${PADDING_PX}px }
</style></head>
<body>${isMermaid ? mermaidBody(diagram.source, theme, libraryDir) : drawioBody(diagram.source, theme, libraryDir)}</body></html>`
}
