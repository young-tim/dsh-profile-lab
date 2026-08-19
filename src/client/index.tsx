import type { Context } from "@deepseek-ai/cordis";
import type { ConvViewProps } from "@deepseek-ai/dsh-client-ui-conversation/client";
import { useMemo } from "react";
import {
  extractLatestReport,
  type ProfileLabReportView,
} from "./report-data.js";

const styles = `
.pl-root{--pl-ink:#19231f;--pl-muted:#68736e;--pl-line:#dfe5e1;--pl-paper:#f8faf8;--pl-card:#fff;--pl-accent:#18785f;--pl-accent-soft:#e8f3ee;--pl-warn:#a56816;--pl-bad:#b6473d;height:100%;overflow:auto;color:var(--pl-ink);background:linear-gradient(135deg,#fbfcfb 0%,#f4f7f5 100%);font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
.pl-shell{width:min(1160px,calc(100% - 48px));margin:0 auto;padding:34px 0 72px}.pl-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:28px}.pl-kicker{color:var(--pl-accent);font-size:11px;font-weight:750;letter-spacing:.16em;text-transform:uppercase}.pl-title{margin:5px 0 3px;font:650 clamp(24px,3vw,38px)/1.1 ui-serif,Georgia,serif;letter-spacing:-.025em}.pl-sub{color:var(--pl-muted);font-size:13px}.pl-state{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid #c8ddd4;border-radius:999px;background:var(--pl-accent-soft);color:var(--pl-accent);font-size:11px;font-weight:700;letter-spacing:.05em}.pl-state:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}.pl-state.warn{border-color:#ead9bb;background:#fbf4e8;color:var(--pl-warn)}
.pl-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}.pl-stat{min-height:112px;padding:17px 18px;border:1px solid var(--pl-line);border-radius:12px;background:color-mix(in srgb,var(--pl-card) 92%,transparent);box-shadow:0 10px 30px rgba(32,50,41,.04)}.pl-stat-label{color:var(--pl-muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.pl-stat-value{margin-top:9px;font:650 25px/1 ui-serif,Georgia,serif}.pl-stat-note{margin-top:9px;color:var(--pl-muted);font-size:12px}
.pl-section{margin-top:28px}.pl-section-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:11px}.pl-section h2{margin:0;font-size:14px;letter-spacing:.01em}.pl-section-note{color:var(--pl-muted);font-size:12px}.pl-card{border:1px solid var(--pl-line);border-radius:14px;background:var(--pl-card);overflow:hidden}.pl-variant{display:grid;grid-template-columns:minmax(120px,1.2fr) minmax(190px,2.6fr) 90px 100px 100px;align-items:center;gap:18px;padding:17px 20px;border-top:1px solid var(--pl-line)}.pl-variant:first-child{border-top:0}.pl-name{font-weight:700}.pl-base{display:block;margin-top:2px;color:var(--pl-accent);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.pl-track{height:8px;overflow:hidden;border-radius:999px;background:#edf1ef}.pl-fill{height:100%;min-width:2px;border-radius:inherit;background:var(--pl-accent)}.pl-rate{margin-top:6px;color:var(--pl-muted);font-size:11px}.pl-number{text-align:right;font-variant-numeric:tabular-nums}.pl-number strong{display:block;font-size:13px}.pl-number span{color:var(--pl-muted);font-size:10px;text-transform:uppercase}.pl-delta{font-size:12px;font-weight:700}.pl-positive{color:var(--pl-accent)}.pl-negative{color:var(--pl-bad)}.pl-neutral{color:var(--pl-muted)}
.pl-composition{margin-top:5px;color:var(--pl-muted);font-size:10px;line-height:1.45}.pl-composition code{font-family:ui-monospace,SFMono-Regular,monospace}.pl-layer{display:inline-flex;margin:4px 4px 0 0;padding:2px 6px;border-radius:999px;background:var(--pl-accent-soft);color:var(--pl-accent);font-size:9px;font-weight:700}
.pl-patch-details{margin-top:7px;border:1px solid var(--pl-line);border-radius:8px;background:var(--pl-paper)}.pl-patch-details summary{cursor:pointer;padding:6px 8px;color:var(--pl-ink);font-size:10px;font-weight:700}.pl-patch-details pre{max-height:260px;margin:0;padding:8px;overflow:auto;border-top:1px solid var(--pl-line);white-space:pre-wrap;word-break:break-word;color:var(--pl-ink);font:10px/1.5 ui-monospace,SFMono-Regular,monospace}
.pl-table-wrap{overflow:auto}.pl-table{width:100%;border-collapse:collapse;min-width:650px}.pl-table th,.pl-table td{padding:12px 15px;border-top:1px solid var(--pl-line);text-align:right;font-variant-numeric:tabular-nums}.pl-table thead th{border-top:0;background:var(--pl-paper);color:var(--pl-muted);font-size:10px;letter-spacing:.07em;text-transform:uppercase}.pl-table th:first-child,.pl-table td:first-child,.pl-table th:nth-child(2),.pl-table td:nth-child(2){text-align:left}.pl-pill{display:inline-flex;padding:3px 8px;border-radius:999px;background:var(--pl-accent-soft);color:var(--pl-accent);font-size:11px;font-weight:700}.pl-pill.muted{background:#eef1ef;color:var(--pl-muted)}.pl-footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:13px}.pl-empty{height:100%;display:grid;place-items:center;padding:32px}.pl-empty-card{width:min(560px,100%);padding:36px;border:1px solid var(--pl-line);border-radius:16px;background:var(--pl-card);text-align:center;box-shadow:0 20px 60px rgba(32,50,41,.06)}.pl-flask{width:58px;height:58px;margin:0 auto 18px;display:grid;place-items:center;border-radius:50%;background:var(--pl-accent-soft);color:var(--pl-accent);font-size:25px}.pl-empty h2{margin:0 0 8px;font:650 22px ui-serif,Georgia,serif}.pl-empty p{margin:0;color:var(--pl-muted)}.pl-how{margin:22px 0 0;padding:18px 20px;border:1px solid var(--pl-line);border-radius:12px;background:var(--pl-paper);text-align:left}.pl-how-title{margin-bottom:8px;font-size:12px;font-weight:750}.pl-how ol{margin:0;padding-left:20px;color:var(--pl-muted)}.pl-how li+li{margin-top:6px}.pl-prompt{display:block;margin-top:13px;padding:10px 12px;border-left:3px solid var(--pl-accent);border-radius:4px 8px 8px 4px;background:var(--pl-card);color:var(--pl-ink);font:12px/1.55 ui-monospace,SFMono-Regular,monospace}
@media(max-width:820px){.pl-shell{width:min(100% - 28px,1160px);padding-top:24px}.pl-head{align-items:flex-start;flex-direction:column}.pl-grid{grid-template-columns:repeat(2,1fr)}.pl-variant{grid-template-columns:1fr 2fr 76px}.pl-variant .pl-number:nth-last-child(-n+2){display:none}}
@media(max-width:520px){.pl-grid{grid-template-columns:1fr}.pl-variant{grid-template-columns:1fr 80px}.pl-variant .pl-bar{display:none}}
@media(prefers-color-scheme:dark){.pl-root{--pl-ink:#e5ebe7;--pl-muted:#9aa7a0;--pl-line:#34413a;--pl-paper:#1d2521;--pl-card:#17201c;--pl-accent:#6bc9a7;--pl-accent-soft:#203b31;--pl-warn:#e3b564;--pl-bad:#ee8177;background:linear-gradient(135deg,#121915,#18201c 100%)}.pl-stat{box-shadow:none}.pl-track{background:#2c3832}}
`;

const pct = (value: number) => `${(value * 100).toFixed(value === 1 ? 0 : 1)}%`;
const integer = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const duration = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toFixed(1)} s`
    : `${integer.format(value)} ms`;
const signed = (value: number, suffix: string) =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;

function EmptyState() {
  return (
    <div className="pl-root pl-empty">
      <style>{styles}</style>
      <div className="pl-empty-card">
        <div className="pl-flask" aria-hidden="true">
          ⌁
        </div>
        <h2>暂无 Profile 组合对比报告</h2>
        <p>运行评测后，工具会自动生成报告并显示在这里。</p>
        <div className="pl-how">
          <div className="pl-how-title">如何运行评测</div>
          <ol>
            <li>准备包含用例与 Profile 组合的实验配置文件。</li>
            <li>在对话中让模型运行实验；完成后报告会自动显示。</li>
          </ol>
          <code className="pl-prompt">
            运行 examples/experiment.yml，将结果保存到
            .profile-lab/run-001；完成后生成对比报告。
          </code>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ report }: { report: ProfileLabReportView }) {
  const best = report.variants.reduce((current, item) =>
    item.pass_rate > current.pass_rate ? item : current,
  );
  const cases = new Set(report.per_case.map((item) => item.case)).size;
  const latency = report.variants.map((item) => item.median_duration_ms);
  const tokens = report.variants.map((item) => item.median_tokens);
  const comparison = new Map(
    report.comparisons.map((item) => [item.variant, item]),
  );
  const compositions = new Map(
    (report.compositions ?? []).map((item) => [item.variant, item]),
  );
  const pareto = new Set([
    ...report.pareto_quality_cost,
    ...report.pareto_quality_latency,
  ]);
  return (
    <div className="pl-root">
      <style>{styles}</style>
      <main className="pl-shell">
        <header className="pl-head">
          <div>
            <div className="pl-kicker">Profile Lab / Experiment report</div>
            <h1 className="pl-title">{report.experiment}</h1>
            <div className="pl-sub">
              基线 {report.baseline} · {report.variants.length} 个方案 · {cases}{" "}
              个用例
            </div>
          </div>
          <div className={`pl-state${report.incomplete ? " warn" : ""}`}>
            {report.incomplete ? "结果不完整" : "实验已完成"}
          </div>
        </header>

        <section className="pl-grid" aria-label="实验概览">
          <Metric
            label="最高通过率"
            value={pct(best.pass_rate)}
            note={best.variant}
          />
          <Metric
            label="中位时延区间"
            value={`${duration(Math.min(...latency))}–${duration(Math.max(...latency))}`}
            note="跨全部方案"
          />
          <Metric
            label="中位 Token 区间"
            value={`${integer.format(Math.min(...tokens))}–${integer.format(Math.max(...tokens))}`}
            note="输入与输出合计"
          />
          <Metric
            label="Pareto 前沿"
            value={String(pareto.size)}
            note="质量 / 成本 / 时延"
          />
        </section>

        <section className="pl-section">
          <div className="pl-section-head">
            <h2>方案表现</h2>
            <span className="pl-section-note">与基线的决策级对比</span>
          </div>
          <div className="pl-card">
            {report.variants.map((variant) => {
              const delta = comparison.get(variant.variant);
              const composition = compositions.get(variant.variant);
              const deltaClass =
                !delta || delta.pass_rate_delta_pp === 0
                  ? "pl-neutral"
                  : delta.pass_rate_delta_pp > 0
                    ? "pl-positive"
                    : "pl-negative";
              return (
                <div className="pl-variant" key={variant.variant}>
                  <div>
                    <span className="pl-name">{variant.variant}</span>
                    {variant.variant === report.baseline && (
                      <span className="pl-base">Baseline</span>
                    )}
                    {composition && (
                      <div className="pl-composition">
                        <div>
                          Profile · <code>{composition.profile}</code>
                        </div>
                        <div>
                          Patch · <code>{composition.patch}</code>
                        </div>
                        <div>
                          {composition.layers.length ? (
                            composition.layers.map((layer) => (
                              <span className="pl-layer" key={layer.id}>
                                {layer.id}
                                {layer.keys.length
                                  ? ` · ${layer.keys.join(" / ")}`
                                  : ""}
                              </span>
                            ))
                          ) : (
                            <span className="pl-layer">无额外 Patch</span>
                          )}
                        </div>
                        {composition.layers.length > 0 && (
                          <details className="pl-patch-details">
                            <summary>展开 Patch 内容</summary>
                            <pre>
                              {JSON.stringify(
                                composition.layers.map((layer) => layer.detail),
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="pl-bar">
                    <div className="pl-track">
                      <div
                        className="pl-fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, variant.pass_rate * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="pl-rate">
                      {variant.pass}/{variant.total} 通过 · {variant.error} 错误
                      {variant.flaky ? " · 波动" : ""}
                    </div>
                  </div>
                  <div className="pl-number">
                    <strong>{pct(variant.pass_rate)}</strong>
                    <span>通过率</span>
                  </div>
                  <div className="pl-number">
                    <strong>{duration(variant.median_duration_ms)}</strong>
                    <span>中位时延</span>
                  </div>
                  <div className={`pl-number pl-delta ${deltaClass}`}>
                    <strong>
                      {delta ? signed(delta.pass_rate_delta_pp, " pp") : "基准"}
                    </strong>
                    <span>质量变化</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pl-section">
          <div className="pl-section-head">
            <h2>用例矩阵</h2>
            <span className="pl-section-note">定位具体退化与错误</span>
          </div>
          <div className="pl-card pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>用例</th>
                  <th>方案</th>
                  <th>通过</th>
                  <th>错误</th>
                  <th>通过率</th>
                  <th>中位 Token</th>
                  <th>中位时延</th>
                </tr>
              </thead>
              <tbody>
                {report.per_case.map((item) => (
                  <tr key={`${item.case}:${item.variant}`}>
                    <td>{item.case}</td>
                    <td>{item.variant}</td>
                    <td>
                      {item.pass}/{item.total}
                    </td>
                    <td>{item.error}</td>
                    <td>{pct(item.pass_rate)}</td>
                    <td>{integer.format(item.median_tokens)}</td>
                    <td>{duration(item.median_duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pl-footer">
            <span className="pl-pill">
              质量 / 时延：
              {report.pareto_quality_latency.join("、") || "不可用"}
            </span>
            <span className="pl-pill muted">
              质量 / 成本：
              {report.pareto_quality_cost.join("、") || "未配置价格"}
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="pl-stat">
      <div className="pl-stat-label">{label}</div>
      <div className="pl-stat-value">{value}</div>
      <div className="pl-stat-note">{note}</div>
    </div>
  );
}

export function ProfileLabView({ useSession }: ConvViewProps) {
  const nodes = useSession((snapshot) => snapshot.nodes);
  const report = useMemo(() => extractLatestReport(nodes), [nodes]);
  return report ? <Dashboard report={report} /> : <EmptyState />;
}

export const inject = ["slots"];

export function apply(ctx: Context) {
  ctx.slots.inject("conversation.view", () =>
    ctx.slots.register(
      {
        name: "conversation.view",
        id: "profile-lab-analysis",
        order: 20,
        label: "Profile 组合对比",
      },
      ProfileLabView,
    ),
  );
}
