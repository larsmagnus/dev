export type AttachmentKind = 'image' | 'document' | 'file'

export type Attachment = {
	ref: string
	kind: AttachmentKind
	mediaType: string
	filename?: string
	context?: string
	addedAt: number
	path: string
	thumbPath?: string
	width?: number
	height?: number
	bytes?: number
}

declare module 'claude-code' {
	interface PluginState {
		attachments: {
			items: Attachment[]
		}
	}
}
