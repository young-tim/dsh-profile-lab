window.__ModuleLoader__.load({id:"dsh-profile-lab",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  ProfileLabView: () => ProfileLabView,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/report-data.ts
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var reportShape = (value) => record(value) && value.version === 1 && typeof value.experiment === "string" && typeof value.baseline === "string" && typeof value.incomplete === "boolean" && Array.isArray(value.variants) && value.variants.every(
  (variant) => record(variant) && typeof variant.variant === "string" && typeof variant.pass_rate === "number" && typeof variant.median_duration_ms === "number" && typeof variant.median_tokens === "number"
) && Array.isArray(value.per_case) && Array.isArray(value.comparisons) && Array.isArray(value.pareto_quality_cost) && Array.isArray(value.pareto_quality_latency);
var extractLatestReport = (nodes) => {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (!record(node) || node.kind !== "tool-result" || node.isError === true)
      continue;
    const call = node.call;
    if (!record(call) || call.name !== "profile_lab_compare") continue;
    const content = Array.isArray(node.content) ? node.content : [];
    for (const block of content) {
      if (!record(block) || block.type !== "text" || typeof block.text !== "string")
        continue;
      try {
        const parsed = JSON.parse(block.text);
        if (reportShape(parsed)) return parsed;
      } catch {
      }
    }
  }
  return null;
};

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var styles = `
.pl-root{--pl-ink:#19231f;--pl-muted:#68736e;--pl-line:#dfe5e1;--pl-paper:#f8faf8;--pl-card:#fff;--pl-accent:#18785f;--pl-accent-soft:#e8f3ee;--pl-warn:#a56816;--pl-bad:#b6473d;height:100%;overflow:auto;color:var(--pl-ink);background:linear-gradient(135deg,#fbfcfb 0%,#f4f7f5 100%);font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
.pl-shell{width:min(1160px,calc(100% - 48px));margin:0 auto;padding:34px 0 72px}.pl-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:28px}.pl-kicker{color:var(--pl-accent);font-size:11px;font-weight:750;letter-spacing:.16em;text-transform:uppercase}.pl-title{margin:5px 0 3px;font:650 clamp(24px,3vw,38px)/1.1 ui-serif,Georgia,serif;letter-spacing:-.025em}.pl-sub{color:var(--pl-muted);font-size:13px}.pl-state{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid #c8ddd4;border-radius:999px;background:var(--pl-accent-soft);color:var(--pl-accent);font-size:11px;font-weight:700;letter-spacing:.05em}.pl-state:before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}.pl-state.warn{border-color:#ead9bb;background:#fbf4e8;color:var(--pl-warn)}
.pl-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}.pl-stat{min-height:112px;padding:17px 18px;border:1px solid var(--pl-line);border-radius:12px;background:color-mix(in srgb,var(--pl-card) 92%,transparent);box-shadow:0 10px 30px rgba(32,50,41,.04)}.pl-stat-label{color:var(--pl-muted);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.pl-stat-value{margin-top:9px;font:650 25px/1 ui-serif,Georgia,serif}.pl-stat-note{margin-top:9px;color:var(--pl-muted);font-size:12px}
.pl-section{margin-top:28px}.pl-section-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:11px}.pl-section h2{margin:0;font-size:14px;letter-spacing:.01em}.pl-section-note{color:var(--pl-muted);font-size:12px}.pl-card{border:1px solid var(--pl-line);border-radius:14px;background:var(--pl-card);overflow:hidden}.pl-variant{display:grid;grid-template-columns:minmax(120px,1.2fr) minmax(190px,2.6fr) 90px 100px 100px;align-items:center;gap:18px;padding:17px 20px;border-top:1px solid var(--pl-line)}.pl-variant:first-child{border-top:0}.pl-name{font-weight:700}.pl-base{display:block;margin-top:2px;color:var(--pl-accent);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.pl-track{height:8px;overflow:hidden;border-radius:999px;background:#edf1ef}.pl-fill{height:100%;min-width:2px;border-radius:inherit;background:var(--pl-accent)}.pl-rate{margin-top:6px;color:var(--pl-muted);font-size:11px}.pl-number{text-align:right;font-variant-numeric:tabular-nums}.pl-number strong{display:block;font-size:13px}.pl-number span{color:var(--pl-muted);font-size:10px;text-transform:uppercase}.pl-delta{font-size:12px;font-weight:700}.pl-positive{color:var(--pl-accent)}.pl-negative{color:var(--pl-bad)}.pl-neutral{color:var(--pl-muted)}
.pl-table-wrap{overflow:auto}.pl-table{width:100%;border-collapse:collapse;min-width:650px}.pl-table th,.pl-table td{padding:12px 15px;border-top:1px solid var(--pl-line);text-align:right;font-variant-numeric:tabular-nums}.pl-table thead th{border-top:0;background:var(--pl-paper);color:var(--pl-muted);font-size:10px;letter-spacing:.07em;text-transform:uppercase}.pl-table th:first-child,.pl-table td:first-child,.pl-table th:nth-child(2),.pl-table td:nth-child(2){text-align:left}.pl-pill{display:inline-flex;padding:3px 8px;border-radius:999px;background:var(--pl-accent-soft);color:var(--pl-accent);font-size:11px;font-weight:700}.pl-pill.muted{background:#eef1ef;color:var(--pl-muted)}.pl-footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:13px}.pl-empty{height:100%;display:grid;place-items:center;padding:32px}.pl-empty-card{width:min(560px,100%);padding:36px;border:1px solid var(--pl-line);border-radius:16px;background:var(--pl-card);text-align:center;box-shadow:0 20px 60px rgba(32,50,41,.06)}.pl-flask{width:58px;height:58px;margin:0 auto 18px;display:grid;place-items:center;border-radius:50%;background:var(--pl-accent-soft);color:var(--pl-accent);font-size:25px}.pl-empty h2{margin:0 0 8px;font:650 22px ui-serif,Georgia,serif}.pl-empty p{margin:0;color:var(--pl-muted)}.pl-how{margin:22px 0 0;padding:18px 20px;border:1px solid var(--pl-line);border-radius:12px;background:var(--pl-paper);text-align:left}.pl-how-title{margin-bottom:8px;font-size:12px;font-weight:750}.pl-how ol{margin:0;padding-left:20px;color:var(--pl-muted)}.pl-how li+li{margin-top:6px}.pl-prompt{display:block;margin-top:13px;padding:10px 12px;border-left:3px solid var(--pl-accent);border-radius:4px 8px 8px 4px;background:var(--pl-card);color:var(--pl-ink);font:12px/1.55 ui-monospace,SFMono-Regular,monospace}
@media(max-width:820px){.pl-shell{width:min(100% - 28px,1160px);padding-top:24px}.pl-head{align-items:flex-start;flex-direction:column}.pl-grid{grid-template-columns:repeat(2,1fr)}.pl-variant{grid-template-columns:1fr 2fr 76px}.pl-variant .pl-number:nth-last-child(-n+2){display:none}}
@media(max-width:520px){.pl-grid{grid-template-columns:1fr}.pl-variant{grid-template-columns:1fr 80px}.pl-variant .pl-bar{display:none}}
@media(prefers-color-scheme:dark){.pl-root{--pl-ink:#e5ebe7;--pl-muted:#9aa7a0;--pl-line:#34413a;--pl-paper:#1d2521;--pl-card:#17201c;--pl-accent:#6bc9a7;--pl-accent-soft:#203b31;--pl-warn:#e3b564;--pl-bad:#ee8177;background:linear-gradient(135deg,#121915,#18201c 100%)}.pl-stat{box-shadow:none}.pl-track{background:#2c3832}}
`;
var pct = (value) => `${(value * 100).toFixed(value === 1 ? 0 : 1)}%`;
var integer = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
var duration = (value) => value >= 1e3 ? `${(value / 1e3).toFixed(1)} s` : `${integer.format(value)} ms`;
var signed = (value, suffix) => `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
function EmptyState() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-root pl-empty", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: styles }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-empty-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-flask", "aria-hidden": "true", children: "\u2301" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u6682\u65E0 Profile \u7EC4\u5408\u5BF9\u6BD4\u62A5\u544A" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u8FD0\u884C\u8BC4\u6D4B\u540E\uFF0C\u6700\u65B0\u7ED3\u679C\u4F1A\u81EA\u52A8\u663E\u793A\u5728\u8FD9\u91CC\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-how", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-how-title", children: "\u5982\u4F55\u8FD0\u884C\u8BC4\u6D4B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "\u51C6\u5907\u5305\u542B\u7528\u4F8B\u4E0E Profile \u7EC4\u5408\u7684\u5B9E\u9A8C\u914D\u7F6E\u6587\u4EF6\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "\u5728\u5BF9\u8BDD\u4E2D\u8BA9\u6A21\u578B\u8FD0\u884C\u5B9E\u9A8C\uFF0C\u5E76\u5728\u5B8C\u6210\u540E\u751F\u6210\u5BF9\u6BD4\u62A5\u544A\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: "pl-prompt", children: "\u8FD0\u884C examples/experiment.yml\uFF0C\u5C06\u7ED3\u679C\u4FDD\u5B58\u5230 .profile-lab/run-001\uFF1B\u5B8C\u6210\u540E\u751F\u6210\u5BF9\u6BD4\u62A5\u544A\u3002" })
      ] })
    ] })
  ] });
}
function Dashboard({ report }) {
  const best = report.variants.reduce(
    (current, item) => item.pass_rate > current.pass_rate ? item : current
  );
  const cases = new Set(report.per_case.map((item) => item.case)).size;
  const latency = report.variants.map((item) => item.median_duration_ms);
  const tokens = report.variants.map((item) => item.median_tokens);
  const comparison = new Map(
    report.comparisons.map((item) => [item.variant, item])
  );
  const pareto = /* @__PURE__ */ new Set([
    ...report.pareto_quality_cost,
    ...report.pareto_quality_latency
  ]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: styles }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { className: "pl-shell", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "pl-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-kicker", children: "Profile Lab / Experiment report" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { className: "pl-title", children: report.experiment }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-sub", children: [
            "\u57FA\u7EBF ",
            report.baseline,
            " \xB7 ",
            report.variants.length,
            " \u4E2A\u65B9\u6848 \xB7 ",
            cases,
            " ",
            "\u4E2A\u7528\u4F8B"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `pl-state${report.incomplete ? " warn" : ""}`, children: report.incomplete ? "\u7ED3\u679C\u4E0D\u5B8C\u6574" : "\u5B9E\u9A8C\u5DF2\u5B8C\u6210" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "pl-grid", "aria-label": "\u5B9E\u9A8C\u6982\u89C8", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Metric,
          {
            label: "\u6700\u9AD8\u901A\u8FC7\u7387",
            value: pct(best.pass_rate),
            note: best.variant
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Metric,
          {
            label: "\u4E2D\u4F4D\u65F6\u5EF6\u533A\u95F4",
            value: `${duration(Math.min(...latency))}\u2013${duration(Math.max(...latency))}`,
            note: "\u8DE8\u5168\u90E8\u65B9\u6848"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Metric,
          {
            label: "\u4E2D\u4F4D Token \u533A\u95F4",
            value: `${integer.format(Math.min(...tokens))}\u2013${integer.format(Math.max(...tokens))}`,
            note: "\u8F93\u5165\u4E0E\u8F93\u51FA\u5408\u8BA1"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Metric,
          {
            label: "Pareto \u524D\u6CBF",
            value: String(pareto.size),
            note: "\u8D28\u91CF / \u6210\u672C / \u65F6\u5EF6"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "pl-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-section-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u65B9\u6848\u8868\u73B0" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pl-section-note", children: "\u4E0E\u57FA\u7EBF\u7684\u51B3\u7B56\u7EA7\u5BF9\u6BD4" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-card", children: report.variants.map((variant) => {
          const delta = comparison.get(variant.variant);
          const deltaClass = !delta || delta.pass_rate_delta_pp === 0 ? "pl-neutral" : delta.pass_rate_delta_pp > 0 ? "pl-positive" : "pl-negative";
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-variant", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pl-name", children: variant.variant }),
              variant.variant === report.baseline && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pl-base", children: "Baseline" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-bar", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-track", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "div",
                {
                  className: "pl-fill",
                  style: {
                    width: `${Math.max(0, Math.min(100, variant.pass_rate * 100))}%`
                  }
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-rate", children: [
                variant.pass,
                "/",
                variant.total,
                " \u901A\u8FC7 \xB7 ",
                variant.error,
                " \u9519\u8BEF",
                variant.flaky ? " \xB7 \u6CE2\u52A8" : ""
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-number", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: pct(variant.pass_rate) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u901A\u8FC7\u7387" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-number", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: duration(variant.median_duration_ms) }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4E2D\u4F4D\u65F6\u5EF6" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `pl-number pl-delta ${deltaClass}`, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: delta ? signed(delta.pass_rate_delta_pp, " pp") : "\u57FA\u51C6" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u8D28\u91CF\u53D8\u5316" })
            ] })
          ] }, variant.variant);
        }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "pl-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-section-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "\u7528\u4F8B\u77E9\u9635" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pl-section-note", children: "\u5B9A\u4F4D\u5177\u4F53\u9000\u5316\u4E0E\u9519\u8BEF" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-card pl-table-wrap", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "pl-table", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u7528\u4F8B" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u65B9\u6848" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u901A\u8FC7" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u9519\u8BEF" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u901A\u8FC7\u7387" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u4E2D\u4F4D Token" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "\u4E2D\u4F4D\u65F6\u5EF6" })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: report.per_case.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: item.case }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: item.variant }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
              item.pass,
              "/",
              item.total
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: item.error }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: pct(item.pass_rate) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: integer.format(item.median_tokens) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: duration(item.median_duration_ms) })
          ] }, `${item.case}:${item.variant}`)) })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-footer", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "pl-pill", children: [
            "\u8D28\u91CF / \u65F6\u5EF6\uFF1A",
            report.pareto_quality_latency.join("\u3001") || "\u4E0D\u53EF\u7528"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "pl-pill muted", children: [
            "\u8D28\u91CF / \u6210\u672C\uFF1A",
            report.pareto_quality_cost.join("\u3001") || "\u672A\u914D\u7F6E\u4EF7\u683C"
          ] })
        ] })
      ] })
    ] })
  ] });
}
function Metric({
  label,
  value,
  note
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pl-stat", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-stat-label", children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-stat-value", children: value }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pl-stat-note", children: note })
  ] });
}
function ProfileLabView({ useSession }) {
  const nodes = useSession((snapshot) => snapshot.nodes);
  const report = (0, import_react.useMemo)(() => extractLatestReport(nodes), [nodes]);
  return report ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, { report }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {});
}
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject(
    "conversation.view",
    () => ctx.slots.register(
      {
        name: "conversation.view",
        id: "profile-lab-analysis",
        order: 20,
        label: "Profile \u7EC4\u5408\u5BF9\u6BD4"
      },
      ProfileLabView
    )
  );
}
return module.exports;}});
