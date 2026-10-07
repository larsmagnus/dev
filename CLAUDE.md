# Development Approach, Principles and Rules

> **Scope:** Follow these principles for all work, unless explicitly overridden by project-specific CLAUDE.md files.

## Principles

- Favor simplicity over cleverness, deletion over addition
- Be efficient, not careless. The best code is the code never written
- For code, favor readability over brevity. For text, nothing, then absolute terseness
- Favor functional code, early returns and shallow nesting
- Favor self-documenting code over standalone docs and inline comments
- Take accountability and fix preexisting issues that overlap with your work
- Favor strict, typesafe code and use zod to validate unknown inputs
- Favor DRY code, but not at the expense of DX, simplicity and pragmatism
- Favor the idiomatic approach for the language and framework
- Match the patterns and code style of the existing code

### Rules

- No abstractions that weren't explicitly requested
- No new dependency if it can be avoided
- No boilerplate nobody asked for
- Shortest working diff wins, but only once you understand the problem. The smallest change in the wrong place isn't efficient, it's a second bug
- Question complex requests or pre-existing norms: "Do you actually need X, or does Y cover it?"
- Pick the edge-case-correct option when two stdlib approaches are the same size, efficient means less code, not the flimsier algorithm

## Communication

- When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision

## Delegation

- Use `@agents/test-architect` subagent when creating, updating or reviewing tests
- Use `@agents/docs-architect` when writing markdown, creating documentation, system prompts, or subagents

## Text

- Text explain WHY, the code shows WHAT
- Reserve text for what code cannot express: ADRs, decisions, design choices, intent and reasoning - even if this is not the current approach in the project
- Decouple text from code: specific counts, file names and similar references create drift and maintenance burden
- Never open on an implementation detail or mention point-in-time references not available to a cold reader
- Never restate signatures or what the code shows - If there's no non-obvious rationale, write nothing or the shortest true text on the intent
- Never narrate your process - It may seem important and non-obvious at the time, but it becomes bloat after the fact

### Docs (standalone)

- Code is the truth, docs are rationale - docs can't be executed or tested and quickly goes out of sync with code
- Only consider docs when the code can't carry the why on its own - even then, docs must be well justified
- Order of preference for docs - Whichever tier carries the point, in order of preference:
  - Self-documenting code, a behavior-driven test, short code comment, or a terse standalone doc

### Code comments

Default to no comments. When you want to write a comment, make the code carry the point instead: naming, extraction, types, zod schemas.

- Add one block TSDoc comment to every function, method and class - this is hygiene, not bloat
- Open the comment with a one-line conclusion a cold reader needs, don't add a tag per param
- Single-line comments are rare, not routine. Only write if a careful reader would think "wait, why" - even then it must be well-justified

## Testing Quick Reference

- Priority: Integration &gt; Browser/UI &gt; Unit tests
- Write for humans, test behavior not implementation
- Use realistic values (`user-123`), not `foo/bar/baz`
- Keep tests WET, avoid complex abstractions
- When a feature maps over N items, require one test per item covering all N — not representative samples
