---
paths:
  - '**/*.{test,spec}.{ts,tsx,js,jsx}'
---

# Testing Quality Rules

- Vitest for unit tests, Playwright for E2E, Playwright CT for component integration tests. Follow the project's existing choice where it differs
- Never add test-only utilities. A seam that exists only for tests drifts from the path users take
