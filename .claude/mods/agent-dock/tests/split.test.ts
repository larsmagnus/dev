import { expect, test } from 'claude-code/testing'

import {
	DEFAULT_SHARE,
	isOverList,
	parseDividerMessage,
	parseShare,
	scrolledOffset,
	shareAfterDrag,
	splitProps,
	treeRowsFor,
} from '../hooks/split'

test('treeRowsFor should give the tree its share of the body, rounded to whole rows', () => {
	expect(treeRowsFor(0.5, 40)).toBe(20)
	expect(treeRowsFor(0.5, 25)).toBe(13)
	expect(treeRowsFor(0.3, 40)).toBe(12)
})

test('treeRowsFor should keep the share between 15% and 85% of the body', () => {
	expect(treeRowsFor(0, 40)).toBe(6)
	expect(treeRowsFor(-2, 40)).toBe(6)
	expect(treeRowsFor(1, 40)).toBe(34)
	expect(treeRowsFor(7, 40)).toBe(34)
})

test('shareAfterDrag should move the divider down by the rows dragged', () => {
	expect(shareAfterDrag(0.5, 40, 4)).toBe(0.6)
})

test('shareAfterDrag should move the divider up when the rows are negative', () => {
	expect(shareAfterDrag(0.5, 40, -4)).toBe(0.4)
})

test('shareAfterDrag should stop at 15% and 85% however far the drag goes', () => {
	expect(shareAfterDrag(0.5, 40, -1000)).toBe(0.15)
	expect(shareAfterDrag(0.5, 40, 1000)).toBe(0.85)
})

test('shareAfterDrag should not divide by zero when the body has no rows', () => {
	expect(shareAfterDrag(0.5, 0, 3)).toBe(0.85)
})

test('parseShare should return a stored number unchanged inside the range', () => {
	expect(parseShare(0.7)).toBe(0.7)
})

test('parseShare should clamp a stored number outside the range', () => {
	expect(parseShare(0.02)).toBe(0.15)
	expect(parseShare(3)).toBe(0.85)
})

test('parseShare should fall back to an even split for anything that is not a finite number', () => {
	expect(DEFAULT_SHARE).toBe(0.5)
	for (const stored of [
		undefined,
		null,
		'0.7',
		'wide',
		{ share: 0.7 },
		[0.7],
		true,
		Number.NaN,
		Number.POSITIVE_INFINITY,
	])
		expect(parseShare(stored)).toBe(0.5)
})

test('parseDividerMessage should read a drag step with the body it was drawn in', () => {
	expect(parseDividerMessage({ moveBy: -3, bodyRows: 32 })).toEqual({
		moveBy: -3,
		bodyRows: 32,
		isDone: false,
	})
})

test('parseDividerMessage should read the end of a drag', () => {
	expect(parseDividerMessage({ done: true })).toEqual({
		moveBy: 0,
		bodyRows: 1,
		isDone: true,
	})
})

test('parseDividerMessage should not treat a done that is not true as the end of a drag', () => {
	expect(parseDividerMessage({ done: 'true' })).toMatchObject({ isDone: false })
})

test('parseDividerMessage should ignore a drag step whose fields are not numbers', () => {
	expect(parseDividerMessage({ moveBy: '4', bodyRows: '40' })).toEqual({
		moveBy: 0,
		bodyRows: 1,
		isDone: false,
	})
})

test('parseDividerMessage should return nothing for data that is not an object', () => {
	expect(parseDividerMessage(null)).toBeUndefined()
	expect(parseDividerMessage('done')).toBeUndefined()
	expect(parseDividerMessage(12)).toBeUndefined()
})

test('splitProps should cut the scroll body to the tree rows and keep every other prop', () => {
	const props = {
		title: 'Files',
		bodyColumns: 60,
		scroll: { offset: 7, bodyRows: 40 },
	}

	expect(splitProps(props, 0.25)).toEqual({
		treeRows: 10,
		props: {
			title: 'Files',
			bodyColumns: 60,
			scroll: { offset: 7, bodyRows: 10 },
		},
	})
	expect(props.scroll.bodyRows).toBe(40)
})

test('splitProps should assume a 40 row body and pass props through when the pane has no scroll', () => {
	const props = { title: 'Files', bodyColumns: 60, scroll: undefined }

	const split = splitProps(props, 0.5)

	expect(split.treeRows).toBe(20)
	expect(split.props).toBe(props)
})

test('isOverList should be true only for a pointer on a row below the divider', () => {
	expect(isOverList({ row: 21 }, 20)).toBe(true)
	expect(isOverList({ row: 39 }, 20)).toBe(true)
})

test('isOverList should be false on the tree rows and on the divider row itself', () => {
	expect(isOverList({ row: 0 }, 20)).toBe(false)
	expect(isOverList({ row: 19 }, 20)).toBe(false)
	expect(isOverList({ row: 20 }, 20)).toBe(false)
})

test('isOverList should be false without a pointer', () => {
	expect(isOverList(undefined, 20)).toBe(false)
})

test('isOverList should treat row 0 as the divider in a pane with no tree', () => {
	expect(isOverList({ row: 0 }, 0)).toBe(false)
	expect(isOverList({ row: 1 }, 0)).toBe(true)
})

test('scrolledOffset should move the offset by the ticks asked for in either direction', () => {
	expect(scrolledOffset(0, 2, 5)).toBe(2)
	expect(scrolledOffset(3, -1, 5)).toBe(2)
})

test('scrolledOffset should stop at the first and at the last entry', () => {
	expect(scrolledOffset(1, -10, 5)).toBe(0)
	expect(scrolledOffset(3, 10, 5)).toBe(4)
})

test('scrolledOffset should stay at 0 when there is one entry or none', () => {
	expect(scrolledOffset(0, 3, 1)).toBe(0)
	expect(scrolledOffset(0, 3, 0)).toBe(0)
})
