import type { EngineInterface, Register, UiPressArgument } from 'claude-code'

/** Estimates the screen rows a message wraps to, to tell whether it is taller than the screen. */
const wrappedRows = (text: string, columns: number) =>
	text
		.split('\n')
		.reduce(
			(rows, line) => rows + Math.max(1, Math.ceil(line.length / columns)),
			0
		)

/** Returns the press that copies a message's raw markdown and toasts the outcome. */
const copyMessage =
	($: EngineInterface, text: string) => async (press: UiPressArgument) => {
		const result = await $.ui.copy({ text, surface: press.surface })
		$.ui.toast(
			result.isCopied ? 'Message copied' : `Copy failed, ${result.reason}`
		)
	}

/** Adds a copy button above each message, and a second below long ones so no scroll back up is needed. */
export const register: Register = (on, options) => {
	const longMessageChars =
		typeof options.longMessageChars === 'number'
			? options.longMessageChars
			: 2000

	on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
		const { text, isSummary } = e.props
		const canPress =
			e.surface === 'terminal' && e.viewport?.isFullscreen !== false
		if (!canPress || isSummary || text.trim() === '') return next(e)

		const { Box, Button, Text } = $.ui.resolve(e)
		const isLong =
			text.length >= longMessageChars ||
			(e.viewport !== undefined &&
				wrappedRows(text, e.viewport.columns) > e.viewport.rows)

		/** Builds the copy button shown at one spot in the message. */
		const copyButton = (place: 'above' | 'below') => (
			<Button
				key={`copy-${place}`}
				label="copy"
				plain
				onPress={copyMessage($, text)}
			>
				<Text color="success">[ copy ]</Text>
			</Button>
		)

		return (
			<Box flexDirection="column">
				{await next(e)}
				<Box position="absolute" top={0} right={0}>
					{copyButton('above')}
				</Box>
				{isLong && <Box justifyContent="flex-end">{copyButton('below')}</Box>}
			</Box>
		)
	})
}
