# Development Approach, Principles and Rules

> **Scope:** Follow these principles for all code changes, tests, and technical decisions unless explicitly overridden by project-specific CLAUDE.md files.

## Primary principles

- <rule>Favor simplicity over cleverness.</rule>
- <rule>Favor readability over brevity.</rule>
- <rule>Favor functional code, early returns and shallow nesting.</rule>
- <rule>Write strict, typesafe code. Use zod to validate unknown inputs. Never use the `any` type, even in tests.</rule>
- <rule>Always validate solutions (correctness, appropriateness, maintainability, simplicity) and run typechecks, linting, tests, formatting after significant changes.</rule>
- <rule>Strive for DRY code, but never at the expense of DX, simplicity and pragmatism</rule>
- <rule>Use the most idiomatic approach for the language and framework.</rule>
- <rule>Strive to match the patterns and code style of the existing codebase.</rule>
- <rule>Use @agents/test-architect when writing or reviewing tests.</rule>
- <rule>Use @agents/docs-architect when creating documentation, system prompts, or subagents.</rule>

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
