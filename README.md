# DSH Profile Lab

[![CI](https://github.com/young-tim/dsh-profile-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/young-tim/dsh-profile-lab/actions/workflows/ci.yml)
[![DSH plugin](https://img.shields.io/badge/DSH-plugin-1f6feb)](https://github.com/topics/dsh-plugin)

DSH Profile Lab 是 DeepSeek Harness 的本地实验与发布门禁工具。它在隔离
workspace 中重复运行多个 DSH profile/patch 组合，基于官方持久化 session
事件计算质量、token、费用、时延和稳定性，并输出可审计报告。

产品包含完整的命令行闭环、三个 DSH 工具，以及 Web profile 会话中的“Profile 组合对比”
页签：`profile_lab_compare` 完成后，页签自动读取当前会话最近一次结构化报告，
展示方案概览、基线差异、用例矩阵与 Pareto 前沿。云托管、账号系统和自动安装
插件仍不属于本产品边界。

## Install as a DSH plugin

当前可直接从 GitHub 安装到 headless 或 web profile：

```bash
dsh plugin --profile headless add github:young-tim/dsh-profile-lab
# 或
dsh plugin --profile web add github:young-tim/dsh-profile-lab
```

安装后重启对应 DSH 进程，模型即可使用 `profile_lab_run`、
`profile_lab_compare` 和 `profile_lab_gate`。Web profile 还会在“对话 / 轨迹”旁
增加“Profile 组合对比”页签；当前会话尚未调用 `profile_lab_compare` 时，空状态会说明
如何准备实验配置、让模型运行评测并生成报告。卸载命令：

```bash
dsh plugin --profile headless remove dsh-profile-lab
dsh plugin --profile web remove dsh-profile-lab
```

第三方 DSH 插件以当前用户权限运行。安装前应检查源码；Profile Lab 默认临时复用
当前 DSH 登录凭证，子进程结束后立即清理。安全边界见
[`docs/SECURITY.md`](docs/SECURITY.md)。

## Requirements

- Node.js `^22.19.0 || >=24.0.0`
- pnpm 11
- `@deepseek-ai/dsh` `0.1.0-rc.7`
- 一个可运行的 DSH profile；默认 driver 是 PATH 中的 `dsh`

真实运行可能调用模型并产生费用。默认的 `run.credentials: inherit` 会临时复用当前
`DSH_HOME/.credentials.yaml`，无需再次配置 Key。CI 可使用 `credentials: env-only`
并通过 `run.env_allowlist` 显式授权所需环境变量。

## 10-minute quick start

```bash
pnpm install --frozen-lockfile
pnpm build

# 校验完整 experiment、case 和嵌套字段
node dist/cli.js schema --check examples/experiment.yml

# 使用已登录的真实 DSH；结果目录必须为空或由 Profile Lab 创建
node dist/cli.js run examples/experiment.yml \
  --output .profile-lab/real-run

node dist/cli.js compare .profile-lab/real-run
node dist/cli.js gate .profile-lab/real-run \
  --policy examples/policy-pass.yml
```

不调用模型的发布验收使用仓库内 deterministic driver：

```bash
node dist/cli.js run examples/experiment.yml \
  --driver fixtures/fake-dsh \
  --output .profile-lab/acceptance --restart
node dist/cli.js compare .profile-lab/acceptance
node dist/cli.js gate .profile-lab/acceptance \
  --policy examples/policy.yml
```

从 npm/tarball 安装后可直接使用 `pnpm exec dsh-profile-lab` 或安装器生成的同名 bin；
仓库内开发命令使用刚构建的 `node dist/cli.js`，避免命中过期副本。

`examples/` 是可真实执行的两 variant、两 case、五次重复实验。base 使用空 overlay，
candidate 修改 system prompt；两个 case 都要求读取隔离 workspace 中的明确 marker。

## Experiment

```yaml
schema_version: 1
name: profile-comparison
cases_dir: cases
workspace_template: repo
baseline: base
variants:
  - { id: base, profile: headless, patch: variants/base.yml }
  - { id: candidate, profile: headless, patch: variants/candidate.yml }
repetitions: 5
run:
  concurrency: 2
  timeout_ms: 600000
  max_runs: 100
  max_total_tokens: 100000
  credentials: inherit # 默认值，可省略
pricing:
  base: { input_per_million: 0.14, output_per_million: 0.28 }
  candidate: { input_per_million: 0.14, output_per_million: 0.28 }
```

所有路径以 experiment 文件所在目录为基准。variant patch 必须是官方 DSH 接受的
top-level YAML patch array。配置、case、workspace、patch 和可选 judge 的内容哈希
都会进入 manifest；任一输入变化后继续 resume 会失败，必须显式 `--restart`。

可用筛选参数：`--tag tag-a,tag-b` 和 `--case case-a,case-b`。筛选结果为空属于
配置错误。`--restart` 只清理带有 Profile Lab 所有权标记的结果目录。

## Cases and assertions

```yaml
name: read-marker
prompt: Read README and return the alpha marker.
tags: [smoke]
retries: 1
assert:
  turn_end: completed
  tools_not_called: [dangerous_tool]
  output_contains: PROFILE_LAB_ALPHA
  max_steps: 8
  max_tokens: 5000
  no_tool_errors: true
```

支持 `turn_end`、有序 `tools_called`、`tools_exact`、`tools_not_called`、
`output_contains`、`output_not_contains`、`output_matches`、
`tool_args_contains`、`tool_result_contains`、`max_steps`、`max_tokens`、
`no_tool_errors` 和可选 `output_judge`。非法断言会在启动 cell 前失败。

### Optional output judge

Judge 是用户明确配置的本地可执行 adapter，不会自动调用任何模型：

```yaml
judge:
  command: ./judge-adapter
  timeout_ms: 60000
  env_allowlist: [JUDGE_API_KEY]
```

adapter 从 stdin 接收 `{"prompt", "output", "rubric"}`，最后一行 stdout 返回：

```json
{
  "pass": true,
  "reason": "meets rubric",
  "usage": { "inputTokens": 10, "outputTokens": 2 }
}
```

结构断言先执行；结构失败时 judge 不会运行。Judge 证据和 token 单独记录，并计入
实验总 token 预算。

## Results and recovery

结果目录包含：

- `manifest.json`：规范化 experiment、workspace/case/patch/judge 哈希
- `journal.json`：原子写入的 cell 与 attempt 结果，可用于 resume
- `.runs/<cell>/attempt-N/`：隔离 workspace、已清除凭证的 DSH_HOME、patch 副本和原始证据
- `run-state.json`：完整、预算停止或取消状态
- `report.json`、`report.md`、`report.html`：机器、评审和离线浏览格式

再次执行相同 run 会跳过已经 pass/fail 的 cell。输入哈希变化时默认拒绝恢复。
SIGINT 会停止派发、终止活动子进程树、刷新 journal 并返回退出码 3。

## Gate and exit codes

Policy 支持 `min_candidate_pass_rate`、`max_pass_rate_drop_pp`、
`max_median_token_increase_pct` 和 `max_error_rate`。所有非 baseline variant 都会被
评估，而不是只检查第一个 candidate。

| Code | Meaning                                        |
| ---: | ---------------------------------------------- |
|    0 | run/compare 完整，或 gate 通过                 |
|    1 | gate 检测到策略回归                            |
|    2 | CLI、Schema、输入、baseline 或 policy 配置错误 |
|    3 | 基础设施错误、预算停止、取消或不完整结果       |

## Safety model

- 每个 attempt 使用独立 workspace、DSH_HOME 和 patch 副本。
- 默认从宿主 DSH_HOME 临时复制凭证，权限设为 `0600`，并在 attempt 的 `finally`
  清理；凭证不会进入 manifest、journal 或报告。`credentials: env-only` 可彻底禁用继承。
- 源 workspace、patch 和 judge 在运行后重新哈希；发生变化会失败关闭。
- 拒绝 workspace 中的 symlink、socket、device、FIFO 等特殊文件。
- 子进程使用 argv 数组和 `shell: false`；超时终止整个进程组并升级到 SIGKILL。
- 环境变量默认不继承，仅保留 PATH、HOME、隔离 DSH_HOME 和显式 allowlist 名称。
- journal 与报告在落盘前脱敏；HTML 无脚本、远程资源、遥测或网络请求。

## Development and release verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:integration
pnpm test:package
```

详细产品合同见 [`docs/DEVELOPMENT_SPEC.md`](docs/DEVELOPMENT_SPEC.md)。
