import { readFileSync } from 'node:fs'

import { z } from 'zod'

// Claude Code's PostToolUse payload - only the edited file's path (and the
// session, for once-per-session notices) matters to these hooks.
export const payloadSchema = z.object({
	session_id: z.string().optional(),
	tool_input: z.object({ file_path: z.string() }),
})

/**
 * Parsed stdin payload, or undefined for no stdin, malformed JSON or an
 * unexpected shape - there is nothing to check then, so hooks fail open
 * rather than crash.
 */
export function readPayload(): z.infer<typeof payloadSchema> | undefined {
	try {
		const parsed = payloadSchema.safeParse(JSON.parse(readFileSync(0, 'utf-8')))
		return parsed.success ? parsed.data : undefined
	} catch {
		return undefined
	}
}
