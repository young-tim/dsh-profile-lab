# Acceptance evidence

Accepted 2026-08-19 on macOS, Node v24.12.0, pnpm 11.9.0 and
`@deepseek-ai/dsh` 0.1.0-rc.7. The frozen implementation checklist SHA-256
remains `d54a9c58ace0396d14c1d2898d1832ae2deccdfa9affce6eb9831af7438f4ec4`.

## Product verdict

The local core product is release-acceptable. A user can validate an experiment,
run a real DSH profile/patch matrix, recover or resume durable evidence, compare
baseline and candidates, inspect three offline report formats and apply a policy
gate. Incomplete runs cannot pass either CLI or plugin gate.

Out of scope: web/cloud/team features, automatic plugin lifecycle management,
remote billing lookup and a bundled model-based judge. These are ecosystem
extensions and do not break the local experiment-to-decision loop.

## Verified behavior

- Official argv: `dsh --profile <profile> --patch <patch> <prompt>` runs from an
  isolated workspace with an isolated `DSH_HOME` per attempt.
- Official evidence: packed records, nested assistant messages, usage fields,
  multi-frame zstd and recoverable corrupt tails are projected and audited.
- Reliability: retries retain every attempt; timeout/SIGINT terminate process
  groups; budget and cancellation persist incomplete state; unchanged cells resume.
- Decisions: structural assertions and optional judge are fail-closed; reports
  include overall and per-case baseline deltas, pricing/Pareto when configured,
  failure details, input hashes and incomplete state.
- Plugin: run defaults to `dsh`; compare/gate can continue from only the result
  directory; all candidates are gated; unload aborts active runs and unregisters.
- Package: a tarball installed outside the repository completes
  schema/run/compare/gate, and the official DSH loader accepts `cordis.patch.yml`.

## Commands observed

```text
pnpm format:check / lint / typecheck / build       -> 0
pnpm test:coverage                                 -> 9 files, 139 passed
coverage statements/branches/functions/lines      -> 91.93/86.28/93.91/93.33
pnpm test:integration                              -> 20 passed
pnpm test:package                                  -> 3 passed
official base/candidate dump-config, isolated homes -> exit 0 / exit 0
node dist/cli.js run ...fake-dsh-session...        -> 20 cells, exit 0
node dist/cli.js compare ...                       -> reports written, exit 0
ajv report schema validation                       -> valid, exit 0
gate policy-pass.yml / policy.yml                  -> exit 0 / exit 1
```

Repeated compare produced identical SHA-256 values:

```text
report.json  3f354c7f2e83146306fba92d01d8fb4303cae414999165ab878d50733641d553
report.md    9fba64da0dbae1535a59f9b9b34717e992afdbd220ae0a081a6e009e5b370871
report.html  3cebd28b650faca3a8ae11ab6d3bd24c9e0578e08c11c86c8cfd99bc2b9d998a
```

Acceptance artifacts are in `.profile-lab/release-acceptance/`. Raw DSH session
evidence is intentionally retained there; publish the sanitized reports, not the
raw `.runs` directory, unless its contents have been reviewed.
