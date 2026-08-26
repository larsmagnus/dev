---
paths:
  - '**/*.{ts,tsx}'
---

# React Quality Rules

- Import and use named React types when needed. Don't use React globals like `React.ReactNode`
- Define component props with an explicit interface or type alias, and use that for the function parameter. Do not define inline object types
- Define components with `function` syntax, to get clearer type inference and stack traces. Only use arrow functions where strictly needed

- Use a component for any non-trivial rendering. A plain function returning `ReactNode` can't be memoised, profiled, or tested on its own
- Use semantically correct HTML for structure. Hierarchical lists must use nested ul/li elements, not flat lists with spacing or padding hacks. Tables must use table/thead/tbody/tr/th/td, not divs with grid classes
- Make sure form fields can be cleared without forcing a default value as this breaks functionality
- Reuse the narrowest hook or helper that supplies what you need. A broad orchestrator does work you didn't ask for and couples the component to derivations it never reads
