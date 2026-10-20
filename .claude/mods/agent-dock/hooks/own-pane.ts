const HOST_GRACE_MS = 3000

let loadedAt = 0
let isHostDrawn = false
let isOffered = false

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

/** Claims the one automatic opening of agent-dock's own pane: at once when it lives in a tab, else once the host pane has missed its grace period. */
export const claimOwnPaneOffer = (at: number, isTab: boolean) => {
	const isHostOverdue = isTab || at - loadedAt >= HOST_GRACE_MS
	const isHostInUse = isHostDrawn && !isTab
	if (isOffered || isHostInUse || !isHostOverdue) return false

	isOffered = true
	return true
}

/** Lets the own pane be offered again, as when the person moves agent-dock out of the host pane. */
export const resetOwnPaneOffer = () => {
	isOffered = false
}

/** Reads the room a pane's body gives, falling back to a typical dock height before the first layout. */
export const paneSize = (props: {
	scroll?: { bodyRows: number }
	bodyColumns: number
}) => ({
	bodyRows: props.scroll?.bodyRows ?? 40,
	bodyColumns: props.bodyColumns,
})

let transcriptSize = { columns: 80, visibleRows: 20 }

/** Records the room the open transcript was last drawn in, so a scroll is clamped to what that draw could show. */
export const rememberTranscriptSize = (size: typeof transcriptSize) => {
	transcriptSize = size
}

/** The room the open transcript was last drawn in. */
export const lastTranscriptSize = () => transcriptSize
