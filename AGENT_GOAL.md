# Autonomous Development Goal

你是执行者，本文件是唯一任务入口；中途无人答疑，拿不准的写 `BLOCKED.md`，跳过并继续独立工作。断线或换会话先读 `PROGRESS.md` 接着做，每完成一项立即更新。目标是把本仓库实现为可发布的 DSH Profile Lab：用可复现实验比较 DSH 组合，而不是只证明插件能启动。冲突时按“结果正确与安全 > 可复现 > 功能完整 > 速度”让步。“只允许/不许”是硬约束；建议若有更好方案可改，但在 `PROGRESS.md` 记原因。

## 我替领导拍的板

- 技术栈 → TypeScript ESM、pnpm、Vitest（猜的）｜错了会重做工具链。
- MVP → Headless CLI + DSH bundle/tools，不做 Web UI/云服务（猜的）｜错了会少一个可视界面。
- 包名 → `dsh-profile-lab`、MIT（猜的）｜错了影响发布身份。
- 实验默认本地隔离、禁止原地工作区执行（安全默认）｜代价是复制耗时。
- 不依赖 `dsh-eval-harness` 私有代码，只兼容其 0.3.0 case 子集（实测）｜代价是少量重复实现。
- 不发布 npm、不建远端、不花真实 API 费用；只做到可发布状态（安全默认）。

## 界限

只允许修改本仓库；`docs/DEVELOPMENT_SPEC.md` 是冻结的产品和验收合同，不许删减或放宽。可以新增实现、测试、示例和必要文档。不得修改用户 DSH profile/源码工作区，不运行插件安装更新，不新增 hosted 服务、账号、排行榜、Web 面板或自动调参。新增运行时依赖必须写 `docs/DEPENDENCIES.md` 解释。不可逆操作写 `BLOCKED.md` 后继续别项。

## 现状与任务 0

2026-08-18 实测：本机 Node 24.12.0、pnpm 11.9.0；官方 `@deepseek-ai/dsh` 0.1.0-rc.7，要求 Node `^22.19.0 || >=24.0.0`；官方架构支持 bundle patch、headless profile、`--patch` 和 session event log；本仓库只有规格，无实现。先逐项复核版本、官方命令和规格引用；若不符，将原始输出置于 `BLOCKED.md` 顶部，只暂停受影响部分。核对后先在 `PROGRESS.md` 用不超过 10 行写目标、顺序、最大风险。

## 任务

1. 按规格第 3–6 节建立包、Schema、类型和纯统计模块；先做它们以冻结输入输出。验收：`pnpm lint && pnpm typecheck && pnpm test` 全绿，skip/todo=0。
2. 按第 7–8 节实现隔离矩阵 runner、DSH adapter、原子 journal、取消和断点续跑；所有 subprocess 用 argv。验收：`pnpm test:integration` 全绿，并证明源 fixture 哈希不变、已完成 cell 调用数恒为 1。
3. 实现 JSON/Markdown/离线 HTML、比较和 gate；结果必须来自 session event，不从 UI 文本猜。验收：第 10 节 fake-driver run/compare/gate 命令全绿，golden 重跑字节一致。
4. 实现薄 CLI 和 Cordis 插件三工具，补示例、中英快速开始、依赖说明、兼容说明。验收：`pnpm build && pnpm test:package`，临时 DSH profile 能 dump 出 bundle row 和三个工具。
5. 跑第 10 节全部命令，将真实输出和三次反向验证“红→绿”写入 `docs/ACCEPTANCE.md`；更新 changelog、进度与阻塞。

## 规矩

不许 skip/todo、删测试、放宽断言、mock 被测核心、`|| true`、降覆盖率或改规格逃避失败；覆盖率 lines/statements/functions >=90%、branches >=85%，测试数只增不减。同一验收连败 3 次换下一项并记证据；结果比基线差则回滚该尝试。每阶段单独提交，提交前跑该阶段检查。

## 完成条件

干净 checkout 能用 fake driver 完成 2+ variants、5 repetitions 的矩阵，生成三种确定性报告，已知回归 gate 必须退出 1，中断恢复无重复执行，打包插件能被当前 DSH 加载。全部第 10 节命令通过、覆盖率达标、skip=0、安全 fixture 源目录字节不变；每条都在最终对话贴实际输出，只说完成不算。`BLOCKED.md` 空也写 `None`。最多 5 个实现阶段；跑满即停，如实报告差距。
