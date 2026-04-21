#!/usr/bin/env node

import { exec } from 'child_process'
import { createRequire } from 'module'

import { Command } from 'commander'
import yoctoSpinner from 'yocto-spinner'

const program = new Command()

const require = createRequire(import.meta.url)
const { version } = require('../package.json')

function errorColor(str) {
	// Add ANSI escape codes to display text in red.
	return `\x1b[31m${str}\x1b[0m`
}

// Function to execute shell commands
const execCommand = (cmd) => {
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stderr })
			} else {
				resolve(stdout)
			}
		})
	})
}

program
	.name('pow')
	.description('pow 🤜')
	.version(version)
	.configureOutput({
		// Highlight errors in color.
		outputError: (str, write) => write(errorColor(str)),
	})

program
	.command('pr <title>')
	.description('Create a PR')
	.action(async (_name) => {
		try {
			const spinnerStatus = yoctoSpinner({ text: 'Getting status...' }).start()
			console.log('Getting status...')
			const status = await execCommand('git status')

			if (typeof status === 'string') {
				spinnerStatus.success(`Got status: \n${status}`)
			}

			console.log('Getting labels...')
			const output = await execCommand(`gh label list --json name,description`)

			// Parse the JSON output
			const labels = JSON.parse(output)
			console.log(`GitHub labels`)
			const table = labels.map(({ name, description }) => ({
				Name: name,
				Description: description,
			}))

			// See https://stackoverflow.com/questions/49618069/remove-index-from-console-table
			// See https://nodejs.org/api/console.html
			console.table(table)
		} catch (err) {
			program.error(err.stderr || err.error.message)
		}
	})

program.parse(process.argv)
