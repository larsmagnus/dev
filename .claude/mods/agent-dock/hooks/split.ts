const MIN_SHARE = 0.15
const MAX_SHARE = 0.85

export const DEFAULT_SHARE = 0.5

/** Keeps the host's share of the pane where both halves stay usable. */
const clampShare = (share: number) =>
	Math.min(MAX_SHARE, Math.max(MIN_SHARE, share))

/** Reads a stored share, falling back to an even split for anything that is not one. */
export const parseShare = (stored: unknown) =>
	typeof stored === 'number' && Number.isFinite(stored)
		? clampShare(stored)
		: DEFAULT_SHARE

/** The rows the host pane's tree gets out of the pane's body. */
export const treeRowsFor = (share: number, bodyRows: number) =>
	Math.round(clampShare(share) * bodyRows)

/** The share after the divider was dragged `moveBy` rows; negative moves it up. */
export const shareAfterDrag = (
	share: number,
	bodyRows: number,
	moveBy: number
) => clampShare((treeRowsFor(share, bodyRows) + moveBy) / Math.max(1, bodyRows))

/** Reads a divider message: a drag step in rows out of the body it was drawn in, or the end of a drag. */
export const parseDividerMessage = (data: unknown) => {
	if (typeof data !== 'object' || data === null) return undefined
	const moveBy =
		'moveBy' in data && typeof data.moveBy === 'number' ? data.moveBy : 0
	const bodyRows =
		'bodyRows' in data && typeof data.bodyRows === 'number' ? data.bodyRows : 1
	const isDone = 'done' in data && data.done === true

	return { moveBy, bodyRows, isDone }
}

/** The pane's props as the host should see them: its body cut to the tree's rows, so it lays itself out for the room it really has. */
export const withTreeRows = <P extends { scroll?: { bodyRows: number } }>(
	props: P,
	treeRows: number
): P =>
	props.scroll
		? { ...props, scroll: { ...props.scroll, bodyRows: treeRows } }
		: props

/** The host pane's props with its body cut to the share the divider gives it, and the rows that leaves the tree. */
export const splitProps = <P extends { scroll?: { bodyRows: number } }>(
	props: P,
	share: number
) => {
	const treeRows = treeRowsFor(share, props.scroll?.bodyRows ?? 40)

	return { treeRows, props: withTreeRows(props, treeRows) }
}

/** Whether a scroll moves the agent list: any scroll in the own pane, a wheel tick below the divider in the host pane. */
export const isListScroll = (
	e: { requestId: string; bodyRows: number; pointer?: { row: number } },
	panes: { host: string; own: string },
	share: number
) => {
	// The own pane is all list, so its scroll keys move the list too; the host keeps its keys for its own tree.
	if (e.requestId === panes.own)
		return e.pointer === undefined || isOverList(e.pointer, 0)

	return (
		e.requestId === panes.host &&
		isOverList(e.pointer, treeRowsFor(share, e.bodyRows))
	)
}

/** Whether a wheel tick landed below the divider, on the list rather than the host's tree. */
export const isOverList = (
	pointer: { row: number } | undefined,
	treeRows: number
) => pointer !== undefined && pointer.row > treeRows

/** Moves the first entry shown by `by`, kept within the entries there are. */
export const scrolledOffset = (offset: number, by: number, count: number) =>
	Math.min(Math.max(0, count - 1), Math.max(0, offset + by))
