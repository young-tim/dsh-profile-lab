# Progress

- Baseline: fingerprint verified; Node v24.12.0, pnpm 11.9.0, DSH 0.1.0-rc.7; original 20 tests passed but runner produced only default cases.
- Completed: strict CLI/config/case loading, 20-cell matrix, official envelope event projection, structural assertions, isolated workspaces and atomic resume journal.
- Completed: deterministic JSON/Markdown/HTML reports, baseline comparison/Pareto, policy gate, and three DSH tool registrations reuse services.
- Evidence: `pnpm format:check`, lint, typecheck, test (74), coverage (91.99/85.15/95.34/100), build, and fake-driver 20-cell smoke pass.
- Failure→fix→pass: concurrent journal lost a cell → serialized atomic writes → exact 20 cells; relative fixture lookup failed → experiment-relative fixtures → matrix passes; plugin gate always threw → explicit policy service → plugin gate test passes.
- Completed: pack preflight and in-repository temporary install loaded the tarball and ran `schema valid`; gate exit paths 0/1/2/3 were exercised.
- Next: final command capture and clean commit.
- Risk: zstd decoding and OS SIGINT process-tree verification remain unimplemented in this offline MVP revision.
