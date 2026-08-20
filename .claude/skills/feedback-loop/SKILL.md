---
name: feedback-loop
description: Self-improvement feedback loop. Run after a session, prompt, or plan has been implemented. Reviews the Claude session to draw systematic learnings about approach, workflow, and context — not one-off code fixes. Takes an optional comment naming something the user wants to improve; the run then centres on that. Outputs a report only; no auto-applying changes. Use when user says "feedback loop", "self-review", or invokes /feedback-loop.
argument-hint: 'Something you want to improve, or nothing for a full sweep'
context: fork
agent: general-purpose
---

# Feedback Loop

> A feedback loop is a cyclical process where output becomes input for future operations, enabling adaptation and growth. Keep loops short — validate faster, more often.

The purpose is to improve **how Claude works** over time, not to review code. Findings must make future sessions better, not fix the last one. Output one consolidated report; do not auto-apply changes, commit, or write to memory — the user decides what to act on.

This runs forked, so there's no inherited conversation history — Phase 1's transcript read is what supplies it, not context. `AskUserQuestion` is unavailable forked; the one place this skill would use it (an ambiguous comment) instead proceeds on the likelier reading and says so in `Verdict`.

## Orientation

- **Process over product.** _Why_ a mistake happened matters more than the mistake.
- **Patterns over instances.** One-offs are noise. Recurring friction preventable by a rule/skill/context is signal.
- **Upstream over downstream.** Prefer findings that prevent categories of problems over findings that fix specific outputs.

If a finding is a one-off code fix with no generalisable lesson, **drop it**.

## The comment

The user may pass a comment naming something they want to improve. It sets the centre of gravity for all three phases.

**No comment → run Phases 1–3 unchanged.** Never prompt for one.

With a comment:

- **Restate it as one investigable question** before collecting anything. That restatement goes in the report header so the user can see the reading that was used.
- **If the restatement could plausibly go two materially different ways** ("it felt slow", "that was messy"), use `AskUserQuestion` once to pin it, then proceed. One round only.
- **It is a hypothesis, not a fact.** It directs the search; it does not supply the conclusion. The user is diagnosing from the outside and can be wrong about the cause, the frequency, or whether it happened at all.
- **A code-directed comment is a symptom.** A complaint about a specific bug, file, or code choice is an entry point, not the finding. Work up to the process or context failure behind it — what wasn't read, known, asked, or enforced. If no wider meaning is inferable from the evidence, ask the user rather than reporting a bare code fix. This skill does not become a code review.

## Phase 1: Collect

Process signals are primary; artefacts are secondary.

- **Session history**: review the conversation history for systematic improvements. Always collect from the full exchange history if context has been compacted.
- **Artefacts:** files changed (git status/diff/log), plan followed (if any).

Remember that you can access all `~/.claude` files, to review logs, exchange history, plans, tool calls etc. e.g checking `~/.claude/projects/<hash>/*.jsonl (ls -t | head -1)` for a full exchange history.

- **Redirections:** where did the user correct, clarify, or push back — and what triggered it?
- **Iterations:** what did Claude backtrack on or rewrite, and why?
- **Assumptions:** what was wrongly assumed or should have been verified?
- **Investigation gaps:** what did Claude act on without reading, running, or asking?
- **Tool/skill usage:** used well, skipped when helpful, or used unnecessarily?
- **Clarifying questions:** well-timed, missing, or over-used?
- **Scope:** stayed on task or drifted?

### With a comment

Run the sweep above **and** a targeted pass. The targeted pass is additional, never a replacement.

- **Find the specifics.** Locate the concrete turns, tool calls, and diffs where the comment's subject shows up. Cite or quote them — a finding anchored to a real turn beats a plausible-sounding summary.
- **Look for disconfirming evidence on purpose.** Where did the thing _not_ happen? Did it happen for a reason the user couldn't see from outside? Searching only for confirmation manufactures agreement, which is worse than no report.
- **Habitual comments widen the search.** For "you always…", "every time…", "in general…", the current transcript is too small a sample, and 20 recent transcripts is a floor, not a target — widen further (more transcripts, older ones, other projects) whenever the claim is specific enough that a real recurrence should surface. Search the _behavior_, not just likely user phrasing: a pattern that keeps recurring may never have been called out in these exact words before, so also grep for the artefact it would leave (an Edit shrinking a block just added, a diff undoing the same class of thing). Cheap grep only; do not read whole transcripts. Report how many sessions were checked and what was searched for, so a thin search reads as thin rather than as a clean result.

## Phase 2: Analyse

### With a comment, first

1. **Verdict on the premise** — `supported`, `partly supported`, or `not supported`, decided by the evidence collected. If not supported, establish what actually happened instead. A failed premise never ends the run.
2. **Escalate to cause** — walk the comment up to the level where something persistable exists (rule, convention, skill, context, memory). If the honest answer is that there is no systemic lever, say so explicitly _and_ name the closest thing — the context that would have surfaced the constraint earlier, the question that would have caught it. A comment run must not return nothing.

Then continue with the tracks below, weighted towards the comment.

### Track 1 (primary): Approach & Workflow

For each lens, ask _what would have made this go better, and how do we make that the default?_

- **Planning** — right decomposition, order, and level of planning for the task size.
- **Investigation** — did Claude understand existing code, conventions, and constraints before acting?
- **Context use** — leveraged CLAUDE.md, rules, skills, memory, prior conversation? What upfront context would have saved iterations?
- **Assumptions & verification** — which were wrong? Claims made without running, reading, or testing?
- **Error recovery** — what upstream change would have prevented each correction?
- **Communication** — clarifying questions well-timed; no over-explaining or tool-use narration.
- **Scope discipline** — did what was asked, nothing more, nothing less.

### Track 2 (secondary): Code & Design

**Only include findings that can be persisted and surface a rule, convention, or skill gap.** Qualifying: recurring pattern violations, conflicts with established conventions Claude missed, repeated quality issues fixable at the tooling layer. **Drop:** single bugs, typos, one-file refactors, or "do it right next time" with no systemic lever.

## Phase 3: Report

Numbered list, **Context first, Code last**. No padding — a short report is a good report.

With a comment: comment-related findings lead, then a short `Also observed` section carrying only high-signal findings outside the topic. Marginal unrelated findings are dropped — a comment run is allowed to be shorter than a full sweep.

### Context types

- `~/.claude/CLAUDE.md` — global rule/convention for Claude
- `CLAUDE.md` — local project rule/convention for Claude
- `Rules` — new/updated `.claude/rules/` file scoped to a path or topic
- `Memory` — project quirk worth recalling in future sessions
- `Skill` — new/updated `.claude/skills` skill
- `Reference` — doc/file to `@import` rather than duplicate or miss
- `Docs` — new/updated inline comments, T/JSDoc, or README content
- `Feedback Loop` — improvement to this skill

NOTE: changes to how Claude approaches work (planning, investigation, verification, questions) must be persisted in one of the above.

### Code types (systemic only)

- `Rules` — project convention to enforce via rules
- `Quality` - project conventions that prevents the class of issue - to enforce automatically (lint, format, test, config, et.al.)
- `Refactor` — architectural pattern to generalise or align

### Format

`Comment` and `Verdict` appear only when a comment was passed; so does `Also observed`.

```
Comment: <the comment, as restated>
Verdict: <supported | partly supported | not supported> — <the evidence that decides it>

Context
1. <What happened — one sentence>
   [<Type>]: <What to do about it>

Code
2. <What happened — one sentence>
   [<Type>]: <What to do about it>

Also observed
3. <What happened — one sentence>
   [<Type>]: <What to do about it>
```

### Example

```
Comment: Did Claude re-read files it had already read?
Verdict: partly supported — 4 re-reads, 3 of them after a compaction boundary rather than from forgetting

Context
1. Re-read `routes/api.ts` three times; each followed a context compaction
   [~/.claude/CLAUDE.md]: After compaction, list already-read files before re-reading any of them
2. The one avoidable re-read followed an Edit, to confirm the edit had applied
   [~/.claude/CLAUDE.md]: Never re-read to verify an Edit — Edit errors if it fails to apply

Also observed
3. Reinvented pagination already solved by `usePaginatedQuery`
   [Skill]: Surface project hooks inventory earlier in data-fetching tasks
```

## Anti-patterns

Reconsider if the report lists bugs already fixed this session, says "be more careful" without a systemic lever, has more Code than Context findings, or duplicates existing CLAUDE.md/rules (the finding is then that Claude didn't follow them and how to prevent this from happening again, not that new ones are needed).

With a comment, also reconsider if the report merely restates the comment in longer form, if every finding confirms it and none tests it, if a code-directed comment produced only code findings, or if the report came back empty because the premise turned out to be wrong.
