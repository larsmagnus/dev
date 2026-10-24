import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { FILES, HOME } from './store.ts'

const run = promisify(execFile)
const LABEL = 'co.larsmagnus.feedback-loop'

const escapeXml = (text: string) =>
	text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Renders the LaunchAgent plist. Copies PATH in because launchd starts with a bare one and the worker calls `claude` by name. */
const plist = (
	script: string,
	node: string
) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${LABEL}</string>
<key>ProgramArguments</key><array><string>${escapeXml(node)}</string><string>${escapeXml(script)}</string><string>collect</string><string>--force</string></array>
<key>StartCalendarInterval</key><dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${escapeXml(process.env.PATH ?? '')}</string></dict>
<key>StandardErrorPath</key><string>${FILES.log}</string>
</dict></plist>
`

/** Loads the job, retrying because a bootstrap right after a bootout can fail while launchd is still tearing the old job down. */
async function bootstrap(domain: string, target: string, attempts = 3) {
	try {
		await run('launchctl', ['bootstrap', domain, target])
	} catch (error) {
		if (attempts <= 1) throw error

		await new Promise((done) => setTimeout(done, 500))
		await bootstrap(domain, target, attempts - 1)
	}
}

/** Writes the weekly LaunchAgent and (re)loads it, so running this again after an update repoints the job at the current script. */
export async function installSchedule() {
	const target = join(HOME, 'Library', 'LaunchAgents', `${LABEL}.plist`)
	const domain = `gui/${process.getuid?.() ?? ''}`
	await mkdir(join(HOME, 'Library', 'LaunchAgents'), { recursive: true })
	await writeFile(
		target,
		plist(fileURLToPath(new URL('./run.ts', import.meta.url)), process.execPath)
	)
	await run('launchctl', ['bootout', `${domain}/${LABEL}`]).catch(
		() => undefined
	)
	await bootstrap(domain, target)
	console.log(`scheduled weekly run: ${target}`)
}
