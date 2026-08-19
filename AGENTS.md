# Agent Instructions

Read [`docs/index.md`](docs/index.md) first for the documentation map. Treat
[`docs/DEVELOPMENT_SPEC.md`](docs/DEVELOPMENT_SPEC.md) as the product contract
and read it before editing.

- Use pnpm and TypeScript ESM. Match the Node.js range in the specification.
- Do not weaken the spec's acceptance criteria to make checks pass.
- Do not install plugins into, mutate, or execute cases in a user's real DSH
  profile or source workspace.
- Do not publish to npm or create a remote repository without explicit human
  authorization.

