# Progress

- Baseline: fingerprint verified; Node v24.12.0, pnpm 11.9.0, DSH 0.1.0-rc.7; original 20 tests passed but runner produced only default cases.
- Completed: strict CLI/config/case loading, 20-cell matrix, official JSONL/zstd envelope projection, structural assertions, isolated workspaces and atomic resume journal.
- Completed: deterministic JSON/Markdown/HTML reports, baseline comparison/Pareto, policy gate, and three DSH tool registrations reuse services.
- Evidence: zstd/advanced assertion tests, resume-input rejection, 85 tests, and coverage 92.15/85.50/95.71/93.73 pass.
- Failure→fix→pass: concurrent journal lost a cell → serialized atomic writes → exact 20 cells; relative fixture lookup failed → experiment-relative fixtures → matrix passes; plugin gate always threw → explicit policy service → plugin gate test passes.
- Completed: package test now builds, packs, temporarily installs and invokes the tarball CLI; official DSH RC accepts the Cordis overlay row.
- Next: final command capture and clean commit.
- Risk: OS SIGINT process-tree verification, report redaction/cost detail, and fully strict report-schema validation remain in progress.
