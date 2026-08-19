# DSH Profile Lab 功能开发清单与验收标准

版本：1.0  
日期：2026-08-18  
适用范围：`0.1.0` MVP 修复、开发、测试和发布验收。

## 1. 使用方式

本文是实现清单，不以“测试通过”代替“功能完成”。每个条目只有同时满足以下条件才能勾选：

1. 功能代码已经接入真实调用链，不是仅存在一个未使用函数。
2. 正向测试通过。
3. 至少一个反向测试证明功能损坏时会失败。
4. 验收命令返回约定退出码，并在 `docs/ACCEPTANCE.md` 留下实际输出。
5. 没有通过 `skip`、`todo`、放宽断言、替换被测对象、修改 golden 掩盖错误或 `|| true` 达标。

优先级定义：

- **P0**：发布阻断项，缺一项即不得声明 MVP 完成。
- **P1**：正式发布前必须完成的安全、可靠性和维护性要求。
- **P2**：后续版本候选，不得挤占 P0/P1。

## 2. 当前基线

2026-08-18 独立验收结果：

- `pnpm lint/typecheck/test/test:coverage/build/test:integration/test:package` 返回 0。
- 当前测试为 5 个文件、20 个用例；覆盖率 Statements 92.83%、Branches 85.63%、Functions 93.42%、Lines 100%。
- `pnpm exec dsh-profile-lab ...` 会静默空跑并返回 0，属于假绿灯。
- `node dist/cli.js` 能运行简化示例，但 runner 固定生成 `default` case，未消费真实 case、profile 和 patch。
- 当前 DSH adapter 使用扁平事件和 `assistant/final`；官方 RC 日志使用 `{ type, seq, time, data }` 信封以及 `assistant/message`。
- 插件工具 `profile_lab_gate` 当前始终抛错。
- `pnpm build` 会改变已提交的 `dist/plugin/index.js`，源码与发布产物不同步。

因此当前状态是“原型骨架”，不是可验收 MVP。下面所有 P0/P1 默认未完成。

## 3. P0-1：消除 CLI 和发布假绿灯

### 开发清单

- [ ] 修复 bin 主模块检测，确保直接执行、pnpm bin 链接和安装后 bin 三种路径都调用 `main()`。
- [ ] `schema`、`run`、`compare`、`gate` 必须打印明确结果；无效命令不得静默返回 0。
- [ ] 所有命令遵循统一退出码：成功 `0`、策略回归 `1`、配置错误 `2`、运行不完整/基础设施错误 `3`。
- [ ] 参数解析拒绝缺失值、未知选项和重复冲突选项；不得通过 `a[a.indexOf(k)+1]` 读取不存在参数。
- [ ] 增加 `prepack`，打包前强制 build、typecheck 和测试，保证 tarball 不携带旧 `dist`。
- [ ] 增加 `format` 与 `format:check`；源文件不得以一行塞入多个模块级语句来制造虚高行覆盖率。

### 验收标准

```bash
pnpm build
pnpm exec dsh-profile-lab schema --check examples/experiment.yml
pnpm exec dsh-profile-lab unknown-command
pnpm exec dsh-profile-lab run
pnpm pack --pack-destination .profile-lab/package
git diff --exit-code -- dist
```

机器判定：

- `schema` 输出 `schema valid` 且退出 0。
- 未知命令和缺参数命令退出 2，stderr 包含稳定错误码，不能无输出。
- `pnpm pack` 退出 0；重新解包后的 `dist` 与当前 `src` 构建结果一致。
- build 后 `git diff --exit-code -- dist` 退出 0。

反向验证：临时破坏 bin 入口测试夹具，证明 pnpm 链接调用测试变红；恢复后全绿。

## 4. P0-2：完整实验配置和 Case 加载

### 开发清单

- [ ] 使用 `schemas/experiment.schema.json` 作为真实校验来源，避免 Schema 与手写校验漂移。
- [ ] 校验所有嵌套对象的未知字段、类型、范围、重复 ID、baseline 存在性和预算关系。
- [ ] 所有相对路径以 experiment 文件所在目录为基准，不以进程 cwd 为基准。
- [ ] 安全加载 `cases_dir` 下全部 `.yml/.yaml`，按规范拒绝重复 case 名。
- [ ] 兼容 `dsh-eval-harness 0.3.0` case 子集：`name`、`prompt`、`tags`、`retries`、`assert`。
- [ ] 支持 tag 和 case-name 筛选；筛选后零 case 必须报配置错误。
- [ ] 矩阵为 `variant × case × repetition`，每个 cell ID 稳定且无碰撞。
- [ ] 预检所有 case、workspace、patch 和预算，任一失败时启动 cell 数必须为 0。

### 验收标准

新增至少 2 个 case、2 个 variant、5 次 repetition 的验收示例：

```bash
pnpm exec dsh-profile-lab run examples/experiment.yml \
  --driver fixtures/fake-dsh --output .profile-lab/matrix
pnpm exec dsh-profile-lab compare .profile-lab/matrix
jq -e '.cells | length == 20' .profile-lab/matrix/report.json
jq -e '[.cells[].case] | unique | length == 2' .profile-lab/matrix/report.json
jq -e '[.cells[].variant] | unique | length == 2' .profile-lab/matrix/report.json
```

机器判定：三个 `jq -e` 均退出 0，fake driver 调用日志恰好 20 条。

反向验证：加入重复 case、逃逸路径、未知嵌套字段各运行一次，均在 driver 调用前退出 2。

## 5. P0-3：真实 DSH Profile 与 Patch 执行

### 开发清单

- [ ] 每个 variant 的 `profile` 必须进入真实 DSH CLI argv。
- [ ] 每个 variant 的 patch 必须被解析、校验并与 Profile Lab 隔离 patch 组合后传入 `--patch`。
- [ ] patch 文件哈希进入运行 manifest 和 cell 身份。
- [ ] 不允许安装、删除或更新用户插件；只读现有 profile，使用独立临时 `DSH_HOME` 和 overlay。
- [ ] 默认仅在 attempt 运行期间复用宿主 `.credentials.yaml`，权限固定为 `0600`；成功、失败、超时和取消后均清理。CI 可配置 `credentials: env-only` 禁止继承。
- [ ] fake driver 必须记录完整 argv，测试不能只根据 `--variant` 输出预制结果。
- [ ] 增加一个无需 API key 的官方 DSH 启动/加载 smoke，证明 bundle 和 overlay 能被 RC loader 接受。

### 验收标准

```bash
pnpm test -- test/profile-patch.test.ts
pnpm test:package
```

机器判定：测试必须逐 cell 断言 profile、patch、workspace、session root 和 prompt argv；至少两个 variant 的 patch 哈希不同。临时 DSH profile 能加载打包 bundle，测试结束后临时目录被删除，用户 `DSH_HOME` 哈希不变。

反向验证：给出不存在的 profile 和非法 patch row，两者均退出 2，且用户 profile 无变化。

## 6. P0-4：官方 Session Event 解析与指标投影

### 开发清单

- [ ] 支持官方 `{ type, seq, time, data }` 事件信封，业务字段从 `data` 读取。
- [ ] 最终回答读取 `assistant/message` 的标准内容块；不得依赖不存在的 `assistant/final`。
- [ ] turn 状态读取 `turn/end.data.reason.kind`，正确区分 completed、error、aborted、blocked、interrupted、disposed。
- [ ] 工具调用从 assistant message/tool 事件和 `tool/result` 投影，按 call ID 关联错误。
- [ ] Token 优先读取 usage chunk，缺失时回退到 `assistant/message.usage`，同一步不得重复计数。
- [ ] 分开记录 input、output、reasoning、cacheRead、cacheWrite；`total` 不包含 cacheRead/cacheWrite。
- [ ] 支持纯 JSONL 和多帧 zstd；损坏尾帧可恢复已完成事件并记录 skipped/corrupt 数量。
- [ ] 容忍未知事件，但缺少有效 `turn/end` 时 cell 必须是 error/incomplete。
- [ ] fixture 必须来自或严格复刻官方 RC 类型，禁止只使用项目自造的扁平事件。

### 验收标准

```bash
pnpm test -- test/dsh-events.test.ts
pnpm test -- test/zstd.test.ts
```

机器判定：同一官方 fixture 的 JSONL 与 zstd 投影结果完全一致；Token、工具错误、最终文本哈希和 turn reason 与 fixture 预期一致；未知事件不改变结果。

反向验证：把 `data.reason.kind` 改成未知值、删除 `turn/end`、截断 zstd 尾部，分别得到明确 error、incomplete 和可恢复结果，不能假报 pass。

## 7. P0-5：断言引擎

### 开发清单

- [ ] 实现 `turn_end`。
- [ ] 实现 `tools_called` 保序子序列、`tools_exact`、`tools_not_called`。
- [ ] 实现 `output_contains`、`output_not_contains`、`output_matches` 数组语义。
- [ ] 实现 `tool_args_contains`、`tool_result_contains`。
- [ ] 实现 `max_steps`、`max_tokens`、`no_tool_errors`。
- [ ] 实现 opt-in `output_judge`；结构断言先执行，结构失败时不得调用 judge。
- [ ] 每个失败返回结构化 code、期望值、实际摘要；不得只返回 boolean。
- [ ] 非法正则和非法断言必须在启动 cell 前报错。

### 验收标准

```bash
pnpm test -- test/assertions.test.ts
```

机器判定：每种断言至少有 1 个 pass、1 个 fail、1 个边界用例；judge 测试使用协议级 fake adapter，必须断言“结构失败时调用数为 0”。

## 8. P0-6：Runner 调度、预算、取消与恢复

### 开发清单

- [ ] 按 `concurrency` 并发运行，默认 1、最大 8；调度不得超过上限。
- [ ] `timeout_ms` 到期终止完整子进程树，并保留 partial evidence。
- [ ] `retries` 适用于 fail/error/timeout；所有 attempt 均保留，首个 pass 后停止。
- [ ] `max_runs` 和 `max_total_tokens` 在启动前及运行中双重约束。
- [ ] SIGINT 停止派发、终止活跃子进程、原子刷新 journal 并退出 3。
- [ ] journal 使用版本化 Schema、临时文件加原子 rename；不得出现半截 JSON。
- [ ] resume 校验 experiment、case、patch、workspace 和 runner 版本哈希。
- [ ] 输入变化后默认拒绝 resume；`--restart` 只能清理 Profile Lab 自己拥有的目录。
- [ ] 已完成 cell 在 resume 后调用次数严格保持 1。
- [ ] cell 错误不能中断其他独立 cell，最终整体状态为 incomplete 并退出 3。

### 验收标准

```bash
pnpm test -- test/runner.test.ts
pnpm test -- test/resume.test.ts
pnpm test -- test/cancellation.test.ts
pnpm test -- test/budget.test.ts
```

机器判定：

- 并发测试观测峰值等于配置值且不超过 8。
- timeout 后子进程及其孙进程均不存在。
- 中断后恢复，已完成 cell 调用次数仍为 1，未完成 cell 可继续。
- 超预算不再启动新 cell，CLI 退出 3，报告标记 `incomplete: true`。

## 9. P0-7：安全隔离

### 开发清单

- [ ] 每个 cell 复制独立 workspace，不在源目录执行。
- [ ] 拒绝逃逸 symlink、socket、device、FIFO 和其他特殊文件。
- [ ] 输出目录只能位于调用方明确指定的根目录内。
- [ ] 子进程环境使用 allowlist；报告只记录变量名，不记录值。
- [ ] 不继承代理、云凭证和 Token，除非 experiment 明确列入允许名称。
- [ ] 子进程 argv 使用数组并保持 `shell: false`。
- [ ] journal/report/HTML 对密钥模式和显式 secret 值脱敏。
- [ ] HTML 转义所有不可信文本，不含远程资源、网络请求、遥测和动态脚本。
- [ ] 源 workspace、用户 DSH_HOME 和 variant patch 在验收前后 SHA-256 完全一致。

### 验收标准

```bash
pnpm test -- test/isolation.test.ts
pnpm test -- test/redaction.test.ts
pnpm test -- test/html-security.test.ts
```

反向测试必须尝试：路径逃逸、symlink 逃逸、读取未授权环境变量、修改源 workspace、HTML 注入和孙进程残留；全部被阻断且留下稳定错误码。

## 10. P0-8：统计、比较和报告

### 开发清单

- [ ] 每个 variant × case 输出 pass/fail/error/flaky 的分子和分母。
- [ ] 输出 Wilson 95% 区间；少于 5 次标记 `insufficient-repetitions`。
- [ ] 输出 duration、total token、step 的 median 与 nearest-rank P95。
- [ ] 输出相对 baseline 的百分点差和百分比差。
- [ ] 仅在 experiment 提供价格时计算费用；未提供时显示 unavailable，不查询网络、不填默认价格。
- [ ] 输出质量/费用和质量/延迟 Pareto 成员。
- [ ] `report.json` 包含 schema/version、baseline、comparisons、manifest、hashes、incomplete 状态和 cells。
- [ ] `report.md` 包含摘要、逐 case 对比、失败原因和复现命令。
- [ ] `report.html` 自包含、可离线打开，并与 JSON 数据一致。
- [ ] 相同 journal 反复 compare，三个报告字节一致。
- [ ] `schemas/report.schema.json` 必须严格校验嵌套结构，不能只检查三个顶层字段。

### 验收标准

```bash
pnpm exec dsh-profile-lab compare .profile-lab/matrix
pnpm exec ajv validate -s schemas/report.schema.json \
  -d .profile-lab/matrix/report.json --spec=draft2020
sha256sum .profile-lab/matrix/report.* > /tmp/report.before
pnpm exec dsh-profile-lab compare .profile-lab/matrix
sha256sum .profile-lab/matrix/report.* > /tmp/report.after
diff -u /tmp/report.before /tmp/report.after
```

机器判定：Schema 校验和 diff 均退出 0；JSON 中 baseline 非空，comparisons 数量与 candidate 数量一致。

## 11. P0-9：Gate 和三个 DSH 工具

### 开发清单

- [ ] Gate 实现 `min_candidate_pass_rate`。
- [ ] Gate 实现 `max_pass_rate_drop_pp`。
- [ ] Gate 实现 `max_median_token_increase_pct`。
- [ ] Gate 实现 `max_error_rate`。
- [ ] incomplete/无 baseline/无 candidate 返回退出 3 或 2，不得 PASS。
- [ ] `profile_lab_run`、`profile_lab_compare`、`profile_lab_gate` 调用与 CLI 相同的 application service。
- [ ] `profile_lab_gate` 接受 report/output 和 policy 参数并返回结构化 verdict，不得抛“请使用 CLI”。
- [ ] 工具参数必须使用官方 `defineTool` 类型，不通过 `unknown` 强制转换绕过类型检查。
- [ ] 插件卸载时释放注册、活跃进程和临时资源。

### 验收标准

```bash
pnpm exec dsh-profile-lab gate .profile-lab/matrix \
  --policy examples/policy.yml
pnpm test -- test/plugin-tools.test.ts
```

机器判定：已知 candidate 回归时 CLI 退出 1，工具返回同一 reasons；无回归时两者均 PASS。三个工具必须各有一次成功调用测试，禁止把预期抛错算“可执行”。

## 12. P1：质量、兼容和发布证明

### 开发清单

- [ ] 单元、契约、集成、恢复、安全、CLI、插件和 package 测试分层清晰。
- [ ] 测试总数不少于 60；所有 P0 条目必须有命名测试，不靠单个大测试覆盖。
- [ ] 覆盖率 lines/statements/functions >= 90%，branches >= 85%，skip/todo/only 为 0。
- [ ] 覆盖率必须基于格式化源文件；所有业务模块纳入统计，不得 exclusion。
- [ ] `test:package` 必须真正执行 build、pack、解包、临时 profile 安装、boot/dump 和工具注册验证。
- [ ] 兼容 Node 22.19 和 Node 24 两条 CI；至少 Linux、macOS，Windows runner 可列为 P2，但路径单测必须覆盖 win32 形状。
- [ ] 记录并锁定当前支持的 DSH RC 版本；上游事件契约变化时 contract fixture 必须失败。
- [ ] README 提供 10 分钟 quick start、experiment/case/policy 示例和退出码表。
- [ ] `docs/ACCEPTANCE.md` 用当前提交重新生成，不保留“partial”或已失效声明。
- [ ] `PROGRESS.md` 与实现一致；`BLOCKED.md` 空时明确写 `None`。
- [ ] `CHANGELOG.md` 列明 breaking behavior、兼容版本和已知限制。
- [ ] 未经授权不得 `npm publish`、创建远端仓库或进行真实付费模型调用。

### 验收标准

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:integration
pnpm test:package
pnpm pack --pack-destination .profile-lab/package
git status --short
```

机器判定：所有命令退出 0；测试不少于 60；覆盖率达标；skip/todo/only 为 0；最后 `git status --short` 无输出。

## 13. P2：MVP 后续候选

以下项目不得作为 `0.1.0` 完成条件，也不得在 P0/P1 未完成前开发：

- [ ] DSH Web 设置页和实验仪表盘。
- [ ] 公共或团队排行榜。
- [ ] 云端报告托管与分享。
- [ ] 自动搜索、安装或更新插件。
- [ ] 自动参数优化或自动选择模型。
- [ ] 真实项目原地运行。
- [ ] 团队账号、权限和多租户。

## 14. 最终发布验收

只有满足以下全部条件，才可声明 `0.1.0` MVP 完成：

- [ ] 本文所有 P0、P1 项已勾选，并能追溯到测试名和验收输出。
- [ ] 2 variants × 2 cases × 5 repetitions 产生恰好 20 个真实矩阵 cell。
- [ ] Profile、patch、case prompt 和隔离目录均真实进入 driver/DSH 调用。
- [ ] 官方事件 fixture 的 JSONL/zstd 指标一致。
- [ ] 已知质量回归退出 1，非法配置退出 2，中断/预算停止退出 3。
- [ ] 中断恢复不重复执行已完成 cell。
- [ ] 三种报告确定、Schema 有效、baseline comparisons 完整。
- [ ] 三个 DSH 工具均成功执行一次，返回结果与 CLI 一致。
- [ ] 源 workspace、用户 DSH_HOME、patch 前后哈希不变。
- [ ] 打包产物通过临时官方 DSH profile 加载测试，源码和 dist 同步。
- [ ] 全套检查通过，测试不少于 60，覆盖率达标，skip/todo/only 为 0。
- [ ] `docs/ACCEPTANCE.md` 包含三组真实“红→绿”证据：CLI 链接、策略回归、断点恢复。

最终交付报告必须列出：提交 SHA、Node/pnpm/DSH 版本、测试数、覆盖率、矩阵 cell 数、三种退出码证据、package 文件名和 SHA-256。只写“已完成”不算验收证据。
