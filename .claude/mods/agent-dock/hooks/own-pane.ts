const HOST_GRACE_MS = 3000

const DEFAULT_HOST_PANE = 'filetree'

let hostPane = DEFAULT_HOST_PANE
let loadedAt = 0
let isHostDrawn = false
let isOffered = false

/** Names the pane to split, read from the plugin's options; empty means agent-dock always uses its own. */
export const setHostPane = (option: unknown) => {
	hostPane = typeof option === 'string' ? option.trim() : DEFAULT_HOST_PANE

	return hostPane
}

/** Starts a session's grace period for the host pane to draw, before agent-dock opens its own. */
export const markLoaded = (at: number) => {
	loadedAt = at
	isHostDrawn = false
	isOffered = false
}

/** Records that the host pane is open, so agent-dock's own pane is not needed. */
export const markHostDrawn = () => {
	isHostDrawn = true
}

/** Claims the one automatic opening of agent-dock's own pane, once the host pane has missed its grace period. */
export const claimOwnPaneOffer = (at: number) => {
	const isHostOverdue = hostPane === '' || at - loadedAt >= HOST_GRACE_MS
	if (isOffered || isHostDrawn || !isHostOverdue) return false

	isOffered = true
	return true
}

/** Reads the room a pane's body gives, falling back to a typical dock height before the first layout. */
export const paneSize = (props: {
	scroll?: { bodyRows: number }
	bodyColumns: number
}) => ({
	bodyRows: props.scroll?.bodyRows ?? 40,
	bodyColumns: props.bodyColumns,
})
