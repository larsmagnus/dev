export type AgentRow = {
	id: string
	type: string
	description: string
	status: string
	color: string
	startedAt: number
	endedAt?: number
	recent: string[]
	isArchived?: boolean
}

declare module 'claude-code' {
	interface PluginState {
		'agent-dock': {
			agents: AgentRow[]
			view: { selected: string | null; offset: number; isArchiveOpen?: boolean }
			share: number
		}
	}
}
