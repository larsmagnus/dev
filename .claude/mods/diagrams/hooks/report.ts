/** The reporting script: writes the drawn size onto `body` for `--dump-dom` to read, or `data-failed` when drawing threw. */
export const REPORT = `
	function report(measured) {
		var box = measured.getBoundingClientRect()
		document.body.dataset.size = Math.ceil(box.width) + 'x' + Math.ceil(box.height)
	}
	function fail() { document.body.dataset.failed = 'true' }
	function contentBox(svg, canvasWidth, canvasHeight) {
		var origin = svg.getBoundingClientRect()
		var left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
		svg.querySelectorAll('g').forEach(function (group) {
			var b = group.getBoundingClientRect()
			var isEmpty = b.width === 0 && b.height === 0
			var isCanvas = Math.round(b.width) === canvasWidth && Math.round(b.height) === canvasHeight
			if (isEmpty || isCanvas) return
			left = Math.min(left, b.left - origin.left); top = Math.min(top, b.top - origin.top)
			right = Math.max(right, b.right - origin.left); bottom = Math.max(bottom, b.bottom - origin.top)
		})
		return { x: left, y: top, width: right - left, height: bottom - top }
	}
	function fitDrawio(graph) {
	var waits = 0
	var wait = setInterval(function () {
		var svg = graph.querySelector('svg')
		if (svg && svg.style.minWidth) {
			clearInterval(wait)
			var box = contentBox(svg, graph.offsetWidth, graph.offsetHeight)
			if (!isFinite(box.width)) return fail()
			var width = Math.ceil(box.width) + 4
			var height = Math.ceil(box.height) + 4
			svg.setAttribute('viewBox', (box.x - 2) + ' ' + (box.y - 2) + ' ' + width + ' ' + height)
			svg.style.minWidth = svg.style.minHeight = '0'
			graph.style.width = width + 'px'
			graph.style.height = height + 'px'
			report(document.body)
		}
		else if (++waits > 100) { clearInterval(wait); fail() }
	}, 50)
	}
`
