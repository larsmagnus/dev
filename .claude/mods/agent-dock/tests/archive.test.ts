import { expect, test } from 'claude-code/testing'

import {
	archiveFinished,
	autoArchive,
	hasPendingArchive,
	listedRows,
	newFailures,
	setAutoArchive,
} from '../hooks/archive'
import type { AgentRow } from '../types'

const MINUTE = 60_000
const now = 1_800_000_000_000

const running: AgentRow = {
	id: 'agent-1',
	type: 'Explore',
	description: 'Find auth callers',
	status: 'running',
	color: '#61afef',
	startedAt: now - 30 * MINUTE,
	recent: [],
}
const completed: AgentRow = {
	id: 'agent-2',
	type: 'Plan',
	description: 'Outline the migration',
	status: 'completed',
	color: '#c678dd',
	startedAt: now - 30 * MINUTE,
	endedAt: now - 25 * MINUTE,
	recent: [],
}
const failed: AgentRow = {
	id: 'agent-3',
	type: 'general-purpose',
	description: 'Run the test suite',
	status: 'failed',
	color: '#98c379',
	startedAt: now - 10 * MINUTE,
	endedAt: now - 5 * MINUTE,
	recent: [],
}
const killed: AgentRow = {
	id: 'agent-4',
	type: 'Explore',
	description: 'Trace the login redirect',
	status: 'killed',
	color: '#e5c07b',
	startedAt: now - 8 * MINUTE,
	endedAt: now - 2 * MINUTE,
	recent: [],
}

test('archiveFinished should archive completed, failed and killed agents and leave running ones', () => {
	const rows = archiveFinished([running, completed, failed, killed])

	expect(rows.map((row) => row.isArchived)).toEqual([
		undefined,
		true,
		true,
		true,
	])
})

test('archiveFinished should keep every agent, archived or not', () => {
	const rows = archiveFinished([running, completed, failed, killed])

	expect(rows.map((row) => row.id)).toEqual([
		'agent-1',
		'agent-2',
		'agent-3',
		'agent-4',
	])
})

test('archiveFinished should only archive agents that ended strictly before the given time', () => {
	const rows = archiveFinished([completed, failed, killed], now - 5 * MINUTE)

	expect(rows.map((row) => row.isArchived)).toEqual([
		true,
		undefined,
		undefined,
	])
})

test('autoArchive should archive agents finished longer ago than the option allows', () => {
	setAutoArchive(20)

	const rows = autoArchive([running, completed, failed], now)

	expect(rows.map((row) => row.isArchived)).toEqual([
		undefined,
		true,
		undefined,
	])
})

test('autoArchive should follow a custom number of minutes', () => {
	setAutoArchive(3)

	const rows = autoArchive([completed, failed, killed], now)

	expect(rows.map((row) => row.isArchived)).toEqual([true, true, undefined])
})

test('autoArchive should leave everything alone when the option is 0 or less', () => {
	for (const option of [0, -5]) {
		setAutoArchive(option)

		expect(autoArchive([completed, failed], now)).toEqual([completed, failed])
	}
})

test('autoArchive should fall back to 20 minutes when the option is not a finite number', () => {
	for (const option of [
		undefined,
		null,
		'5',
		Number.NaN,
		Number.POSITIVE_INFINITY,
	]) {
		setAutoArchive(option)

		const rows = autoArchive([completed, failed], now)

		expect(rows.map((row) => row.isArchived)).toEqual([true, undefined])
	}
})

test('hasPendingArchive should be true while a finished unarchived agent waits', () => {
	setAutoArchive(20)

	expect(hasPendingArchive([completed])).toBe(true)
	expect(hasPendingArchive([running, killed])).toBe(true)
})

test('hasPendingArchive should be false when no finished agent is unarchived', () => {
	setAutoArchive(20)

	expect(hasPendingArchive([])).toBe(false)
	expect(hasPendingArchive([running])).toBe(false)
	expect(hasPendingArchive([{ ...completed, isArchived: true }])).toBe(false)
})

test('hasPendingArchive should be false when auto-archive is disabled', () => {
	setAutoArchive(0)

	expect(hasPendingArchive([completed])).toBe(false)
})

test('listedRows should list unarchived agents newest first and hide the archived ones when the archive is closed', () => {
	const rows = listedRows(
		[running, { ...completed, isArchived: true }, failed, killed],
		false
	)

	expect(rows.map((row) => row.id)).toEqual(['agent-4', 'agent-3', 'agent-1'])
})

test('listedRows should follow the unarchived agents with the archived ones, each newest first, when the archive is open', () => {
	const rows = listedRows(
		[
			{ ...completed, isArchived: true },
			running,
			{ ...failed, isArchived: true },
			killed,
		],
		true
	)

	expect(rows.map((row) => row.id)).toEqual([
		'agent-4',
		'agent-1',
		'agent-3',
		'agent-2',
	])
})

test('newFailures should report agents the engine lists as failed or killed that were live in the rows', () => {
	const found = newFailures(
		[
			{ ...failed, status: 'running' },
			{ ...killed, status: 'running' },
		],
		[
			{
				id: 'agent-3',
				type: 'general-purpose',
				description: 'Run the test suite',
				status: 'failed',
			},
			{
				id: 'agent-4',
				type: 'Explore',
				description: 'Trace the login redirect',
				status: 'killed',
			},
		]
	)

	expect(found.map((info) => info.id)).toEqual(['agent-3', 'agent-4'])
})

test('newFailures should ignore completed and still-running agents', () => {
	const found = newFailures(
		[{ ...running }, { ...completed, status: 'running' }],
		[
			{
				id: 'agent-1',
				type: 'Explore',
				description: 'Find auth callers',
				status: 'running',
			},
			{
				id: 'agent-2',
				type: 'Plan',
				description: 'Outline the migration',
				status: 'completed',
			},
		]
	)

	expect(found).toEqual([])
})

test('newFailures should not report an agent that was already finished or never seen', () => {
	const found = newFailures(
		[failed],
		[
			{
				id: 'agent-3',
				type: 'general-purpose',
				description: 'Run the test suite',
				status: 'failed',
			},
			{
				id: 'agent-9',
				type: 'Plan',
				description: 'Draft the release notes',
				status: 'failed',
			},
		]
	)

	expect(found).toEqual([])
})
