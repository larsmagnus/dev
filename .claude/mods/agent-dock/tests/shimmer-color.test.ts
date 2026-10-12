import { expect, test } from 'claude-code/testing'

import { shimmerColor } from '../hooks/shimmer'

const litAt = (phase: number) =>
	Array.from({ length: 10 }, (_, at) => at).filter(
		(at) => shimmerColor(at, phase, 10, '#808080') === '#cccccc'
	)

const brightness = (hex: string) =>
	parseInt(hex.slice(1, 3), 16) +
	parseInt(hex.slice(3, 5), 16) +
	parseInt(hex.slice(5, 7), 16)

test("shimmerColor should light the character under the band's core brighter than the agent colour", () => {
	// length 10 at phase 3 puts the band core on character 1
	const lit = shimmerColor(1, 3, 10, '#808080')

	expect(lit).toBe('#cccccc')
	expect(brightness(lit)).toBeGreaterThan(brightness('#808080'))
})

test('shimmerColor should show the plain agent colour right beside the core', () => {
	expect(shimmerColor(0, 3, 10, '#808080')).toBe('#808080')
	expect(shimmerColor(2, 3, 10, '#808080')).toBe('#808080')
})

test('shimmerColor should dim characters further from the band, darkest at the far edge', () => {
	const near = shimmerColor(3, 3, 10, '#808080')
	const far = shimmerColor(8, 3, 10, '#808080')

	expect(near).toBe('#666666')
	expect(far).toBe('#464646')
	expect(brightness(near)).toBeGreaterThan(brightness(far))
})

test('shimmerColor should order lit, plain, near and far brightness along the band', () => {
	const colors = [1, 0, 3, 8].map((at) => shimmerColor(at, 3, 10, '#61afef'))
	const levels = colors.map(brightness)

	expect(levels).toEqual(levels.toSorted((a, b) => b - a))
	expect(new Set(levels).size).toBe(4)
})

test('shimmerColor should move the lit character along as the phase advances', () => {
	expect(litAt(3)).toEqual([1])
	expect(litAt(5)).toEqual([4])
	expect(litAt(8)).toEqual([9])
})

test('shimmerColor should dim every character while the band is still outside the text', () => {
	const colors = Array.from({ length: 10 }, (_, at) =>
		shimmerColor(at, 0, 10, '#808080')
	)

	expect(new Set(colors)).toEqual(new Set(['#464646']))
})

test('shimmerColor should return a color that is not #rrggbb unchanged at every distance', () => {
	for (const color of ['red', 'ansi:36', '#abc', 'rgb(1,2,3)']) {
		const colors = Array.from({ length: 10 }, (_, at) =>
			shimmerColor(at, 3, 10, color)
		)

		expect(new Set(colors)).toEqual(new Set([color]))
	}
})
