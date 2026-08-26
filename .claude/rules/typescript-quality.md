---
paths:
  - '**/*.{ts,tsx}'
---

# TypeScript Quality Rules

- Use Zod `.parse()` for runtime-validated types when typed access to untyped data is needed
- Use `unknown` and narrow with type guards or Zod, or use proper generics
- Prefer strict types. Avoid optional types where a value is present
- When a Zod schema exists for a data type, do not define a type for the same shape. Derive the type with `z.infer<typeof Schema>` and export that as the canonical type
