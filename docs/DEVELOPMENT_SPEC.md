# DSH Profile Lab Development Specification

Status: implementation contract, version 1.0, 2026-08-18.

## 1. Product decision

DSH Profile Lab answers one question: **which DeepSeek Harness composition is
better on the user's own repeatable tasks, and what quality, cost, latency, and
reliability trade-offs changed?**

The ecosystem already has install/lifecycle test tools and a single-profile
regression runner. The product gap is a reproducible experiment matrix across
profiles, model routes, prompts, skills, and plugin patches, with repeated runs
and decision-grade comparisons.

Primary users are DSH plugin authors, profile maintainers, and teams evaluating
an upgrade. The first release is local-first, headless, deterministic outside
model calls, and usable from both a shell and DSH model tools.

## 2. Verified baseline and compatibility target

Verified on 2026-08-18:

- `@deepseek-ai/dsh` latest is `0.1.0-rc.7`; DSH is a developer preview and may
  make compatibility-breaking changes.
- Official engines are Node `^22.19.0 || >=24.0.0`; the official repository uses
  pnpm 11.7.0. Local authoring environment has Node 24.12.0 and pnpm 11.9.0.
- Profiles are ordered bundle compositions. A package declares
  `dsh.bundle.patch`; `web` and `headless` are standard templates. `--patch`
  overlays are applied last.
- Durable `turn/*`, `step/*`, `assistant/*`, and `tool/*` facts are available in
  session logs. The logs, not rendered UI text, are the measurement source.
- `dsh-eval-harness` 0.3.0 already defines useful case assertions and report
  fields. Profile Lab must accept its documented case YAML as a compatible
  subset, but must not import its private `src/*` or `lib/*` paths.

Reference sources:

- https://github.com/deepseek-ai/deepseek-harness
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md
- https://github.com/BiBoyang/dsh-eval-harness
- https://github.com/awesome-dsh-plugin/awesome-dsh-plugin

Pin DSH RC packages exactly in the initial lockfile. Put DSH-specific parsing
behind adapters so one upstream format change does not infect statistics and
reporting code.

## 3. MVP user journeys

1. Author writes an experiment YAML referencing a case directory and two or
   more variants. Each variant selects an existing profile plus a patch file.
2. `dsh-profile-lab run experiment.yml --output reports/run-001` validates all
   inputs before launching anything, copies each fixture workspace into an
   isolated run directory, executes the case/variant/repetition matrix, and
   writes an append-safe run journal.
3. Interrupted runs resume without rerunning completed cells.
4. `dsh-profile-lab compare reports/run-001` emits `report.json`, `report.md`,
   and a self-contained `report.html`.
5. `dsh-profile-lab gate reports/run-001 --policy policy.yml` returns a stable CI
   exit code and machine-readable reasons.
6. Inside DSH, tools `profile_lab_run`, `profile_lab_compare`, and
   `profile_lab_gate` expose the same application services, not duplicate logic.

## 4. Experiment contract

Publish a JSON Schema at `schemas/experiment.schema.json`. YAML is parsed with
safe schema rules; duplicate keys, aliases, custom tags, unknown top-level
fields, absolute output paths, and `..` escapes are rejected.

Required conceptual shape:

```yaml
schema_version: 1
name: memory-routing-comparison
cases_dir: ./cases
workspace_template: ./fixtures/repo
baseline: base
variants:
  - id: base
    profile: headless
    patch: ./variants/base.patch.yml
  - id: candidate
    profile: headless
    patch: ./variants/candidate.patch.yml
repetitions: 5
run:
  concurrency: 2
  timeout_ms: 600000
  max_runs: 100
  max_total_tokens: 1000000
  credentials: inherit # default; env-only for explicit CI secrets
pricing: # optional; no online price lookup
  base: { input_per_million: 0, output_per_million: 0 }
gate:
  min_candidate_pass_rate: 0.8
  max_pass_rate_drop_pp: 5
  max_median_token_increase_pct: 20
  max_error_rate: 0.05
```

Case compatibility includes `name`, `prompt`, `tags`, `retries`, and the
`dsh-eval-harness` 0.3 assertions: turn end, called/exact/forbidden tools,
output contains/not-contains/regex, tool argument/result contains, maximum
steps/tokens, no tool errors, and optional judge rubric. Judge use is opt-in,
configured separately, recorded as another model call, and never silently
changes a structural failure into a pass.

## 5. Measurement and comparison rules

Every matrix cell records status, attempts, duration, turn end, steps, tool
calls/errors, input/output/reasoning/cache tokens, final-output hash, and paths
to retained evidence. Raw secrets and environment values are never recorded.

For each variant and case report:

- pass/error/flaky rates and numerator/denominator;
- Wilson 95% interval for pass rate;
- median and nearest-rank P95 for duration, total tokens, and steps;
- optional explicit-price estimate, never a fabricated default price;
- delta from baseline in percentage points and percentages;
- quality/cost and quality/latency Pareto membership.

Do not claim statistical significance. With fewer than five repetitions, label
results `insufficient-repetitions`. A candidate is `flaky` when it has both pass
and non-pass outcomes. Results must be deterministic for the same normalized
input fixture.

Exit codes: `0` pass, `1` policy regression, `2` invalid configuration or absent
baseline, `3` infrastructure/incomplete run. A budget stop is incomplete, never
reported as a successful gate.

## 6. Architecture and files

Use TypeScript ESM with these ownership boundaries:

- `src/config`: YAML loading, JSON Schema validation, normalization, hashing.
- `src/runner`: matrix planning, isolated subprocesses, timeout/cancel/resume.
- `src/dsh-adapter`: CLI invocation and session JSONL/zstd event projection.
- `src/assertions`: case assertions and optional judge adapter.
- `src/stats`: pure aggregate, Wilson, quantile, delta, and Pareto functions.
- `src/report`: versioned report model plus JSON/Markdown/static HTML renderers.
- `src/gate`: policy evaluation and exit-code mapping.
- `src/cli`: thin commands over application services.
- `src/plugin`: Cordis apply function and three thin model tools.

The package must export `.`, `./cordis.patch.yml`, `./package.json`, and the
experiment/report schemas. The patch inserts one uniquely named bundle row.
Runtime dependencies should be limited to a maintained YAML parser and packages
required by official DSH contracts. Any additional runtime dependency requires
written justification in `docs/DEPENDENCIES.md`.

## 7. Safety and hard boundaries

- Never run a case in the user's source workspace. Copy the declared template
  into `<output>/.runs/<cell>/workspace`; reject escaping symlinks and special
  files. Each cell gets a separate session root and temporary home.
- Never run `dsh plugin add/remove/update`, package lifecycle scripts, or mutate
  an existing profile. Variants may only reference existing profiles and
  validated patch files.
- Child process arguments are arrays; never construct shell command strings.
- Environment inheritance is an explicit allowlist. Secret values may reach the
  child only when named by configuration; reports contain names, not values.
- Validate the full run count and budgets before launch. Concurrency defaults to
  1 and is capped at 8. Timeouts terminate the full child process tree.
- Journals and reports are written atomically. Resume verifies experiment, case,
  patch, and workspace hashes; changed inputs require a new run or explicit
  `--restart` that only deletes directories owned by Profile Lab.
- Generated HTML is static, escapes all untrusted text, has no remote assets,
  scripts, telemetry, or network requests.
- No hosted service, account system, public leaderboard, Web settings panel,
  automatic optimization, automatic plugin installation, or in-place workspace
  execution in MVP.
- Do not publish npm packages, push a remote, or spend a live API budget without
  explicit human authorization.

## 8. Failure behavior

Preflight all discoverable errors and launch zero cells on invalid config. One
cell failure must be retained and must not corrupt other cells. SIGINT stops new
work, terminates active children, flushes the journal, and exits 3. A second
SIGINT may force exit. Diagnostics identify variant, case, repetition, stage,
and evidence path, while redacting secrets.

Repeated failed attempts honor the case retry count but remain visible. Resume
must be idempotent: a completed cell is never charged or executed twice.

## 9. Required tests

Use Vitest. No test may require a paid API or network by default.

- Unit: schema/path validation, hashing, assertions, token accounting, Wilson
  interval, nearest-rank P95, deltas, Pareto, gate exit codes, redaction.
- Contract fixtures: plain JSONL and multi-frame zstd session logs, unknown event
  tolerance, corrupt tail recovery, and upstream-shape drift diagnostics.
- Integration: a fake `dsh` executable emits deterministic logs and simulates
  pass, fail, timeout, crash, retry, cancellation, partial logs, and secrets.
- Resume: kill a matrix mid-run, resume it, and prove completed cell invocation
  counters remain exactly one.
- Isolation: a fixture attempts path escape, symlink escape, inherited secret
  discovery, and source-workspace modification; all must fail without mutation.
- Reports: schema validation plus deterministic golden JSON/Markdown/HTML.
- Plugin/package: pack the tarball, install it into a temporary DSH home/profile,
  dump config, prove the row and three tools load, then remove the temp home.

Coverage gate: lines/statements/functions >= 90%, branches >= 85%. Test count may
not decrease; skipped/todo tests must be zero.

## 10. Acceptance commands and evidence

The implementation must provide these scripts and make all commands pass from a
clean checkout:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:integration
pnpm test:package
pnpm exec dsh-profile-lab schema --check examples/experiment.yml
pnpm exec dsh-profile-lab run examples/experiment.yml --driver fixtures/fake-dsh --output .profile-lab/acceptance
pnpm exec dsh-profile-lab compare .profile-lab/acceptance
pnpm exec dsh-profile-lab gate .profile-lab/acceptance --policy examples/policy.yml
pnpm pack --pack-destination .profile-lab/package
```

Acceptance additionally requires three deliberate red-to-green demonstrations:
an invalid path exits 2 before any fake-driver invocation; a known regression
exits 1 with the expected reason; an interrupted run resumes without duplicate
invocations. Paste actual outputs into the release report.

No `skip`, `todo`, weakened assertion, mocked unit under test, `|| true`, coverage
exclusion of business modules, or edited golden expected output solely to hide a
regression is acceptable.

## 11. Delivery phases

1. Foundation: package, schemas, types, deterministic stats, and config tests.
2. Execution: isolation, DSH adapter, journal, cancellation, resume, fixtures.
3. Decision layer: aggregation, comparison, gate, report renderers.
4. Product surfaces: CLI, DSH bundle/tools, examples, bilingual quick start.
5. Release proof: full checks, package smoke, threat tests, acceptance evidence,
   changelog, and migration/compatibility notes.

Each phase ends with a green commit and updated progress notes. If an upstream
contract differs from this verified baseline, isolate the adaptation, record
the evidence, and continue with independent pure modules.

## 12. Definition of done

Done means a clean checkout can execute the complete fake-driver experiment,
produce all three deterministic report formats, make a policy gate fail for a
known regression, survive interruption/resume without duplicate work, and load
the packed bundle in the current official DSH profile. All required checks pass,
coverage meets the gate, skipped tests are zero, safety fixtures leave their
source directories byte-identical, and any blocking issue is bounded and
evidenced.
