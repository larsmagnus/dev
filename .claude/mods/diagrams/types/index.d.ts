/** @public Exported because the plugin validator rejects a non-exported top-level type. */
export type Rendered = { file: string; width: number; height: number }

declare module 'claude-code' {
	interface PluginState {
		diagrams: {
			/** Keyed by diagram and theme. `null` marks a diagram that failed to draw, so it is not retried. */
			rendered: Record<string, Rendered | null>
			/** Keyed by diagram; true while the person has chosen its source over its picture. */
			showSource: Record<string, boolean>
		}
	}
}
