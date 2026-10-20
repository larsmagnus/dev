export type Category = 'feature' | 'change' | 'breaking' | 'other'
export type Highlight = { category: Category; text: string }
export type Release = { from: string; to: string; items: Highlight[] }

declare module 'claude-code' {
	interface PluginState {
		'release-highlights': { release: Release | null; isExpanded: boolean }
	}
}
