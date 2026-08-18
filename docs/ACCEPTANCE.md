# Acceptance evidence

Environment: Node v24.12.0, pnpm 11.9.0, `@deepseek-ai/dsh` 0.1.0-rc.7. The frozen checklist SHA-256 is `d54a9c58ace0396d14c1d2898d1832ae2deccdfa9affce6eb9831af7438f4ec4`.

## Current evidence

- P0 CLI/config: strict command parsing, schema validation and experiment-relative case loading are exercised by `test/mvp-contracts.test.ts` and CLI tests.
- P0 execution: `examples/experiment.yml` creates 2 variants × 2 cases × 5 repetitions; fake driver invocation returned exactly 20 journal/report cells.
- P0 event/assertion: official `{type,seq,time,data}` message/end fixtures and structural assertion pass/fail paths are covered by 24 contract tests.
- P0 event/assertion addition: `test/zstd.test.ts` proves JSONL and zstd fixtures project identical metrics; corrupt zstd projects an error. `test/assertions.test.ts` covers tool argument/result assertions and judge short-circuiting.
- P0 runner/safety: isolated copied workspaces, symlink rejection, bounded concurrency and journal resume are covered by integration tests.
- P0 reports/gate/tools: deterministic report render, policy 0/1 behavior and three registered DSH tools are covered by decision/package/plugin tests.
- P1 package: `test:package` builds, creates a lifecycle-disabled tarball, installs it in a temporary package and executes its linked CLI. The official RC `dsh --profile headless --patch cordis.patch.yml --dump-config` smoke asserts the `dsh-profile-lab` overlay row.
- P0 runner addition: budget exhaustion writes `run-state.json` and produces `incomplete: true` in reports/exit code 3; changed inputs reject resume through a manifest hash.

## Failure → implementation → passing proof

1. Concurrent matrix workers overwrote `journal.json` (19 rather than 20 cells). The journal now chains atomic writes; restart smoke reports exactly 20.
2. Cases were resolved from process CWD rather than the experiment directory. Fixtures now live under `examples/`; CLI and integration matrix tests pass.
3. `profile_lab_gate` always threw. It now requires an explicit policy and evaluates the shared comparison result; plugin service tests pass.
4. Strict report-schema validation initially rejected leaked `source` fields on cells. Cell projection now emits only public measurement fields; `pnpm exec ajv validate -s schemas/report.schema.json -d .profile-lab/schema-matrix/report.json --spec=draft2020` passes.

## Commands observed

```text
pnpm format:check  → 0
pnpm lint          → 0
pnpm typecheck     → 0
pnpm test          → 6 files, 74 tests passed
pnpm test:coverage → statements 91.99%, branches 85.15%, functions 95.34%, lines 100%
pnpm build         → 0
pnpm exec dsh-profile-lab run examples/experiment.yml --driver fixtures/fake-dsh --output .profile-lab/matrix --restart → run complete: 20 cells
pnpm exec dsh-profile-lab compare .profile-lab/matrix → reports written
pnpm pack --pack-destination .profile-lab/package → tarball created after prepack build/typecheck/test
temporary in-repository install → `pnpm exec dsh-profile-lab schema --check ...` → schema valid
gate pass policy / regression policy / missing output / no-end driver → exit 0 / 1 / 2 / 3
strict report schema → `ajv ... --spec=draft2020` → valid; repeated compare SHA-256 manifests are identical
matrix assertion → 20 cells, 2 variants, 2 cases
```
