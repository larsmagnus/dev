import { expect, test } from 'claude-code/testing'

import { parseIndex } from '../hooks/archive'
import { factsLine, thumbCells } from '../hooks/format'
import { parseSize } from '../hooks/sips'

const screenshot = {
	ref: '[Image #2]',
	kind: 'image',
	mediaType: 'image/jpeg',
	addedAt: new Date(2026, 9, 11, 17, 18).getTime(),
	path: '/Users/ada/.claude/attachments/session-123/image-2.jpg',
	width: 1100,
	height: 700,
	bytes: 44_848,
} as const

test('should read pixel width and height from sips output', () => {
	const stdout =
		'/Users/ada/.claude/attachments/session-123/image-2.jpg\n  pixelWidth: 1100\n  pixelHeight: 700\n'

	expect(parseSize(stdout)).toEqual({ width: 1100, height: 700 })
})

test('should report no size when sips could not read the file', () => {
	expect(parseSize('Error 4: no file was found')).toBeUndefined()
})

test('should line up time, dimensions and size for an image', () => {
	expect(factsLine(screenshot)).toBe('17:18 · 1100×700 · 45 KB')
})

test('should keep a landscape thumbnail full width and a portrait one full height', () => {
	expect(thumbCells(1100, 700)).toEqual({ columns: 12, rows: 4 })
	expect(thumbCells(700, 1100)).toEqual({ columns: 8, rows: 6 })
})

test('should keep well-formed index entries and drop malformed ones', () => {
	const stored = JSON.stringify([
		screenshot,
		{ ref: '[Image #3]' },
		'not an entry',
	])

	expect(parseIndex(stored)).toEqual([screenshot])
})

test('should treat an unreadable index as an empty archive', () => {
	expect(parseIndex('{ half-written')).toEqual([])
})

test('should give a portrait thumbnail an even width so it centres in its frame', () => {
	expect(thumbCells(1, 1.41)).toEqual({ columns: 8, rows: 6 })
	expect(thumbCells(3, 4)).toEqual({ columns: 10, rows: 6 })
})
