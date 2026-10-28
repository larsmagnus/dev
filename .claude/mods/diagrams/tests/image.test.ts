import { expect, test } from 'claude-code/testing'

import { fitCells } from '../hooks/fit'

test('should convert pixels to cells when the picture is small', () => {
	expect(fitCells({ width: 332, height: 269 })).toEqual({
		columns: 37,
		rows: 15,
	})
})

test('should cap columns at 100 and keep the aspect', () => {
	expect(fitCells({ width: 1800, height: 360 })).toEqual({
		columns: 100,
		rows: 10,
	})
})

test('should cap rows at 255 and keep the aspect', () => {
	const { columns, rows } = fitCells({ width: 900, height: 9180 })

	expect(rows).toBe(255)
	expect(columns).toBe(Math.round(100 * (255 / 510)))
})

test('should apply the tighter of the two caps', () => {
	const { columns, rows } = fitCells({ width: 9000, height: 9180 })

	expect(columns).toBeLessThanOrEqual(100)
	expect(rows).toBeLessThanOrEqual(255)
	expect(columns).toBe(100)
})
