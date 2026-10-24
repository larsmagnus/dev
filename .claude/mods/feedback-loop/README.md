# feedback-loop

Reviews finished Claude sessions in the background and keeps the suggestions for you to approve. Nothing is applied without your approval.

## Install

```sh
claude plugin marketplace add larsmagnus/dev
claude plugin install feedback-loop@larsmagnus --scope user
```

Then run `/feedback-loop:install`, or press `Enable weekly run` in the pane. It installs and loads a LaunchAgent that covers weeks with few sessions, and is repointed automatically after a plugin update. Requires Node 22.18 or newer.

## Use

When suggestions are pending, a band above the prompt offers `Review`. `/feedback-loop:open` opens the same pane any time. Tick suggestions, add a free-text correction, then `Apply` or `Decline`. Unticked ones stay pending. `Run now` collects immediately.

`/feedback-loop [comment]` stays the interactive, single-session review. It reads the ledger so it doesn't repeat what is already pending.

## Why it is shaped this way

- **Queue, then batch.** A session end only drops a file in a queue, because the exit budget is about a second and a review takes minutes. A run reviews the whole queue at once, since recurrence across sessions is the signal the method looks for.
- **Due after a batch of sessions, or a week.** Whichever comes first. A minimum gap between runs stops a failing run retrying on every session end. The weekly job covers weeks where you open few sessions.
- **One worker, three triggers.** The session hooks, the pane and launchd all start `scripts/run.ts`. It takes a lock, so triggers can fire freely, and it is the only writer of the ledger.
- **Headless sessions are never queued.** Otherwise each review would queue itself.
- **Report only, until you decide.** The collector can only read. Applying is a separate run, started from the pane with your ticks and corrections, and your correction overrides a suggestion's own wording.

## The store

Everything lives in `~/.claude/feedback-loop/`, global because most suggestions target global context.

| File                | Role                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `suggestions.jsonl` | Current state of every suggestion, keyed by lesson. Used for dedup and review     |
| `history.jsonl`     | Append-only events. Keeps the story when a suggestion is applied, then overridden |
| `reports/`          | The raw report of each run, for debugging the collector                           |
| `queue/`            | One file per finished session awaiting review                                     |
| `state.json`        | When the last run started                                                         |
| `run.log`           | Failures. Check it when nothing seems to happen                                   |

The `applied` events in `history.jsonl` are the changelog.

An applied suggestion that recurs is reopened, since the fix evidently did not hold. A declined or superseded one only logs the sighting.

## Cost

Collecting and applying both run on Sonnet, each under a USD budget cap. The caps sit beside the calls in `scripts/`.

## Tests

```sh
claude plugin test .
```
