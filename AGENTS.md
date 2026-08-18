# Agent Instructions

Read `docs/DEVELOPMENT_SPEC.md`, `AGENT_GOAL.md`, `PROGRESS.md`, and
`BLOCKED.md` before editing.

- Use pnpm and TypeScript ESM. Match the Node.js range in the specification.
- Treat `docs/DEVELOPMENT_SPEC.md` as the product contract. Do not weaken its
  acceptance criteria to make checks pass.
- Keep `PROGRESS.md` current after every completed phase.
- Record blocked decisions with evidence in `BLOCKED.md`, then continue with
  independent work.
- Do not install plugins into, mutate, or execute cases in a user's real DSH
  profile or source workspace.
- Do not publish to npm or create a remote repository without explicit human
  authorization.

