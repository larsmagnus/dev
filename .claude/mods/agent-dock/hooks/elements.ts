import type { Elements } from 'claude-code'

/** The elements the dock draws with, the ones the terminal and the desktop app both have. */
export type DockElements = Pick<
	Elements['terminal'],
	'Box' | 'Text' | 'Button' | 'Client'
>
