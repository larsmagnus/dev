# Development Approach, Principles and Rules

> **Scope:** Follow these principles for all code changes, tests, and technical decisions unless explicitly overridden by project-specific CLAUDE.md files.

## Primary Principles

- Favor simplicity over cleverness
- Favor readability over brevity
- Favor functional code, early returns and shallow nesting
- Favor self-documenting code over standalone docs and inline comments
- Write strict, typesafe code. Use zod to validate unknown inputs. Never use the `any` type, even in tests
- Validate solutions (correctness, appropriateness, maintainability, simplicity) and run typechecks, linting, tests and formatting after significant changes
- Strive for DRY code, but never at the expense of DX, simplicity and pragmatism
- Use the idiomatic approach for the language and framework
- Strive to match the patterns and code style of the existing code
- Use `@agents/test-architect` when writing or reviewing tests
- Use `@agents/docs-architect` when writing markdown, creating documentation, system prompts, or subagents

## Prose

- Prose explain WHY, the code shows WHAT
- Reserve prose for what code cannot express: ADRs, decisions, design choices, intent and reasoning - even if this is not the current approach in the project
- Never couple prose with code: specific counts, file name references, any other reference will cause drift or become a maintenance burden
- Never open on an implementation detail or mention a forward/backward reference ("below"/"above"/"as mentioned"/"previously"/"after")
- Never restate signatures or what the code shows - If there's no non-obvious rationale, write the shortest true prose on the intent
- Never narrate your debugging process - It may seem important and non-obvious at the time, but it becomes bloat after the fact

### Docs (standalone)

- Code is the truth, docs are rationale - Documentation cannot be executed or tested, so it quickly goes out of sync with code
- Only consider docs when the code can't carry the why on its own - even then, docs must be well justified
- Order of preference for docs: Whichever tier carries the point, in order of preference: self-documenting code, a behavior-driven test, short code comment, or a terse standalone doc

### Code comments

Default to no comments. When you want to write a comment, make the code carry the point instead: naming, extraction, types, zod schemas.

- Block comments are added to every function, method and class - this is hygiene, not bloat
- One TSDoc block comment per function - open with a one-line conclusion a cold reader needs, don't add a tag per param
- Single-line comments are rare, not routine. Only write if a careful reader would think "wait, why" - even then it must be well-justified

## Instructions

- When reporting information to me, be extremely concise and sacrifice grammar for the sake of concision.

## Planning

When the problem space involves many considered-and-rejected approaches, create a temporary exploration, debugging or spike doc:

- Sections: problem, goal, tried and rejected, not attempted
- Create the doc before entering plan mode - This improves plan quality by surfacing prior art and ruling out dead ends upfront
- Discard the doc at the end of the session

## Testing

For detailed testing guidance, use the `@agents/test-architect` subagent when writing or reviewing tests.

### Testing quick reference

- Priority: Integration &gt; Browser/UI &gt; Unit tests
- Write for humans, test behavior not implementation
- Use realistic values (`user-123`), not `foo/bar/baz`
- Keep tests WET, avoid complex abstractions
- When a feature maps over N items (config entries, param lists, rule sets), require one test per item covering all N — not representative samples
