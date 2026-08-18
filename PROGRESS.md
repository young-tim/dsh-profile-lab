# Progress

- Baseline: fingerprint verified; Node v24.12.0, pnpm 11.9.0, DSH 0.1.0-rc.7; original 20 tests passed but runner produced only default cases.
- Completed: strict CLI/config/case loading, 20-cell matrix, official JSONL/zstd envelope projection, structural assertions, isolated workspaces and atomic resume journal.
- Completed: deterministic JSON/Markdown/HTML reports, baseline comparison/Pareto, policy gate, and three DSH tool registrations reuse services.
- Evidence: zstd/advanced assertion tests, resume-input rejection, timeout/cancel tests, 96 tests, and coverage 92.93/86.33/95.48/93.97 pass.
- Failure→fix→pass: concurrent journal lost a cell → serialized atomic writes → exact 20 cells; relative fixture lookup failed → experiment-relative fixtures → matrix passes; plugin gate always threw → explicit policy service → plugin gate test passes.
- Completed: package test now builds, packs, temporarily installs and invokes the tarball CLI; official DSH RC accepts the Cordis overlay row.
- Completed: final frozen-lock install, format, lint, typecheck, test, coverage, build, integration, package, pack, 20-cell matrix, strict-schema and deterministic-report checks.
- Risk: Node 22/Linux CI matrix is not executable in this local macOS workspace; code supports the documented Node engine range.
