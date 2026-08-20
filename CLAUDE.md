# Development Approach, Principles and Rules

> **Scope:** Follow these principles for all code changes, tests, and technical decisions unless explicitly overridden by project-specific CLAUDE.md files.

## Primary principles

- Favor simplicity over cleverness.
- Favor readability over brevity.
- Favor functional code, early returns and shallow nesting.
- Write strict, typesafe code. Use zod to validate unknown inputs. Never use the `any` type, even in tests.
- Always validate solutions (correctness, appropriateness, maintainability, simplicity) and run typechecks, linting, tests, formatting after significant changes.
- Strive for DRY code, but never at the expense of DX, simplicity and pragmatism
- Use the most idiomatic approach for the language and framework.
- Strive to match the patterns and code style of the existing codebase.
- Use @agents/test-architect when writing or reviewing tests.
- Use @agents/docs-architect when creating documentation, system prompts, or subagents.

## Comments

- Prefer minimal comments. In order: self-explanatory code, tests that show behavior, valuable non-obvious inline comments, standalone docs — reach for the next tier only when the one before it can't carry the point.
- Comments explain WHY (rationale, constraints, gotchas), never WHAT (the code already shows that).
- Avoid comments coupled with code: specific counts, file name references, any other reference that may cause drift or become a maintenance burden
- Structure like TSDoc: open with a one-line conclusion a cold reader needs first. Do not open on an implementation detail or a forward/backward reference ("below"/"above"/"as mentioned") — that's mid-thought, not a start.
- Length should track content, not the reverse: a long comment justified by a concrete example, payload, or short list of cases is fine; a long comment that's prose narrating the author's own debugging process is not.

## Instructions

- When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.

## Planning

- When the problem space involves many considered-and-rejected approaches, create a structured debugging doc (problem / tried and rejected / not attempted) before entering plan mode. This significantly improves plan quality by surfacing prior art and ruling out dead ends upfront.

## Testing

For detailed testing guidance, use the `@agents/test-architect` subagent when writing or reviewing tests.

### Testing quick reference

- Priority: Integration > Browser/UI > Unit tests
- Write for humans, test behavior not implementation
- Use realistic values (`user-123`), not `foo/bar/baz`
- Keep tests WET, avoid complex abstractions
- When a feature maps over N items (config entries, param lists, rule sets), require one test per item covering all N — not representative samples
