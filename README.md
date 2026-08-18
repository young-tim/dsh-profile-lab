# DSH Profile Lab

Evidence-based comparison of DeepSeek Harness profiles, model routes, prompts,
skills, and plugin compositions on repeatable agent tasks.

Start with:

- [`docs/DEVELOPMENT_SPEC.md`](docs/DEVELOPMENT_SPEC.md): authoritative product,
  architecture, security, testing, and acceptance specification.
- [`AGENT_GOAL.md`](AGENT_GOAL.md): compact task brief for an autonomous coding
  agent.
- [`PROGRESS.md`](PROGRESS.md): resumable execution log.
- [`BLOCKED.md`](BLOCKED.md): unresolved decisions and evidence.

The MVP is a headless DSH bundle and CLI. It compares experiment variants and
produces reproducible JSON, Markdown, and static HTML reports. A Web dashboard,
hosted service, and public leaderboard are intentionally outside the MVP.

Run repeatable, isolated comparisons of DSH profile compositions. The lab never
executes inside the declared source workspace; each matrix cell receives a copy.

```bash
pnpm install --frozen-lockfile
pnpm build
node dist/cli.js run examples/experiment.yml --driver fixtures/fake-dsh --output .profile-lab/run
node dist/cli.js compare .profile-lab/run
node dist/cli.js gate .profile-lab/run --policy examples/policy.yml
```

中文：DSH Profile Lab 用隔离的可重复实验比较 profile 组合。每个 cell
都会复制工作区，结果来自 session event，而不是 UI 文本。使用 `schema`、
`run`、`compare`、`gate` 命令；参见 `examples/`。

Exit codes: `0` successful run or passing policy, `1` policy regression, `2`
invalid CLI/configuration input, and `3` incomplete/infrastructure failure.

The supported DSH contract is `@deepseek-ai/dsh` `0.1.0-rc.7` on Node
`^22.19.0 || >=24.0.0`. The MVP is local-first: it intentionally does not
provide a web UI, hosted reports, account/team features, automatic plugin
changes, or live paid-model integration.
