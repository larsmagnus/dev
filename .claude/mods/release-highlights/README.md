# release-highlights

A band above the prompt with highlights from the changelog after Claude Code updates.

![Band above the prompt with release-highlights](larsmagnus-release-highlights.png)

Shows three highlights, grouped as new, changed, breaking and other. `Show n more` reveals the rest. `Dismiss` hides the band until the next upgrade.

## Install

```sh
claude plugin marketplace add larsmagnus/dev
claude plugin install release-highlights@larsmagnus --scope user
```

Edits apply with `/reload-plugins`. No reinstall needed.

## Source

The raw `CHANGELOG.md` from GitHub, not the rendered docs page. Raw markdown has one `## <version>` heading per release, which is what the code splits on. The band's link goes to the docs page anchor for the new version.

## Detecting an update

The engine has no event for the "restart to update" banner. So the mod compares the running version with the last seen one in `$.store` on the first session after an upgrade. The first run only records the version, so a fresh install shows nothing.

## Claiming the version

The version is written to the store before the fetch and the summary. A plugin reload or a second session starting meanwhile would otherwise summarise the same upgrade twice, which showed as a duplicate band. If the fetch or the summary fails, the old version is written back, so the next session retries. Failures go to `$.ui.log` only and are never shown. A version with no changelog section is claimed and not retried.

## Deferred work

The announcement runs through `$.clock.after(0)` instead of being awaited in `session.start`. Startup is not blocked by the network and the model call, and the work runs in its own hook frame.

## Skipped versions

Updates that skip versions are summarised as one range. The newest 15 releases are kept, so a long absence cannot flood the model.

## Network and usage

Fetches `raw.githubusercontent.com`. The haiku summary uses the session's own model credentials, so it counts toward usage.

## Engine constraints

The engine imposes these. They shape the code, so don't "fix" them.

- A plugin has exactly one hooks module. Here it is `hooks/register.tsx`.
- Anything that touches `$` or a state atom must live in that module, in top-level functions. `$` cannot be passed into an imported function.

## Tests

```sh
claude plugin test .
```
