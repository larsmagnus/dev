export const READ_ONLY_TOOLS = [
	'Read',
	'Grep',
	'Glob',
	'Bash(ls *)',
	'Bash(git log *)',
	'Bash(git diff *)',
	'Bash(git status *)',
]

export const FINDINGS_SCHEMA = {
	type: 'object',
	required: ['findings'],
	properties: {
		findings: {
			type: 'array',
			items: {
				type: 'object',
				required: [
					'key',
					'project',
					'track',
					'type',
					'finding',
					'action',
					'evidence',
				],
				properties: {
					key: { type: 'string' },
					project: { type: 'string' },
					track: { enum: ['context', 'code'] },
					type: { type: 'string' },
					finding: { type: 'string' },
					action: { type: 'string' },
					evidence: { type: 'array', items: { type: 'string' } },
				},
			},
		},
	},
}

export const RESULTS_SCHEMA = {
	type: 'object',
	required: ['results'],
	properties: {
		results: {
			type: 'array',
			items: {
				type: 'object',
				required: ['key', 'outcome', 'note', 'edits'],
				properties: {
					key: { type: 'string' },
					outcome: { enum: ['applied', 'skipped'] },
					note: { type: 'string' },
					edits: {
						type: 'array',
						items: {
							type: 'object',
							required: ['file', 'find', 'replace'],
							properties: {
								file: { type: 'string' },
								find: { type: 'string' },
								replace: { type: 'string' },
							},
						},
					},
				},
			},
		},
	},
}
