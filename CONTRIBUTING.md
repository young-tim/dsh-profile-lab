# Contributing

## Development

Requirements are Node.js `^22.19.0 || >=24.0.0` and pnpm 11.9.0.

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm test:integration
pnpm test:package
```

Keep changes scoped, add a negative test for failure behavior, and update public
schemas when persisted output changes. Do not weaken coverage thresholds or
commit secrets, real session logs, `.env` files, or `.profile-lab/` results.

## Pull requests

Describe user-visible behavior, compatibility impact, and validation commands.
Generated `dist/` files are versioned and must match the TypeScript source.
