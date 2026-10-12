import { expect, test } from 'claude-code/testing'

import { restoreRows, storedRows, withStoredRows } from '../hooks/persist'
import type { AgentRow } from '../types'

const row = (overrides: Partial<AgentRow> = {}): AgentRow => ({
	id: 'agent-1',
	type: 'Explore',
	description: 'Find auth callers',
	status: 'running',
	startedAt: 1_800_000_000_000,
	recent: ['⏺ Read(src/auth.ts)'],
	color: '#c678dd',
	...overrides,
})

test('storedRows should return the rows stored for the session', () => {
	const stored = {
		'session-4f2a9c': [row()],
		'session-b81d03': [row({ id: 'agent-9' })],
	}

	expect(storedRows(stored, 'session-4f2a9c')).toEqual([row()])
})

test('storedRows should return nothing for a session never stored', () => {
	expect(storedRows({ 'session-b81d03': [row()] }, 'session-4f2a9c')).toEqual(
		[]
	)
})

test('storedRows should return nothing when the store holds no object', () => {
	expect(storedRows(undefined, 'session-4f2a9c')).toEqual([])
	expect(storedRows('corrupt', 'session-4f2a9c')).toEqual([])
	expect(storedRows(null, 'session-4f2a9c')).toEqual([])
})

test('storedRows should drop entries that are not rows', () => {
	const stored = {
		'session-4f2a9c': [row(), { id: 'agent-2' }, 'agent-3', null],
	}

	expect(storedRows(stored, 'session-4f2a9c')).toEqual([row()])
})

test('storedRows should return nothing when a session holds no list', () => {
	expect(storedRows({ 'session-4f2a9c': 'agent-1' }, 'session-4f2a9c')).toEqual(
		[]
	)
})

test('withStoredRows should keep other sessions and replace this one', () => {
	const stored = {
		'session-b81d03': [row({ id: 'agent-9' })],
		'session-4f2a9c': [row({ status: 'running' })],
	}

	const next = withStoredRows(stored, 'session-4f2a9c', [
		row({ status: 'completed' }),
	])

	expect(next).toEqual({
		'session-b81d03': [row({ id: 'agent-9' })],
		'session-4f2a9c': [row({ status: 'completed' })],
	})
})

test('withStoredRows should start from nothing when the store holds no object', () => {
	expect(withStoredRows(undefined, 'session-4f2a9c', [row()])).toEqual({
		'session-4f2a9c': [row()],
	})
})

test('withStoredRows should keep only the 10 newest sessions, dropping the oldest', () => {
	const stored = Object.fromEntries(
		Array.from({ length: 10 }, (_, i) => [`session-${i + 1}`, [row()]])
	)

	const next = withStoredRows(stored, 'session-new', [row()])

	expect(Object.keys(next)).toEqual([
		...Array.from({ length: 9 }, (_, i) => `session-${i + 2}`),
		'session-new',
	])
})

test('withStoredRows should move a rewritten session to the newest position', () => {
	const stored = { 'session-1': [row()], 'session-2': [row()] }

	expect(Object.keys(withStoredRows(stored, 'session-1', [row()]))).toEqual([
		'session-2',
		'session-1',
	])
})

test('restoreRows should end a live row as killed at the restore time', () => {
	const restored = restoreRows([row({ status: 'running' })], 1_800_000_060_000)

	expect(restored).toEqual([
		row({ status: 'killed', endedAt: 1_800_000_060_000 }),
	])
})

test('restoreRows should leave finished rows as they were', () => {
	const finished = ['completed', 'failed', 'killed'].map((status) =>
		row({ status, endedAt: 1_800_000_010_000 })
	)

	expect(restoreRows(finished, 1_800_000_060_000)).toEqual(finished)
})
