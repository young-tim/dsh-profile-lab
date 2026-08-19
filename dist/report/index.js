import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pareto, pct, summarize } from "../stats/index.js";
import { readRunState } from "../runner/index.js";
import { sanitize } from "../security/index.js";
const esc = (x) => x.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export { redact } from "../security/index.js";
const put = async (file, text) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, text);
    await rename(`${file}.tmp`, file);
};
export const report = async (dir, e, cells) => {
    const state = await readRunState(dir);
    let runManifest = {};
    try {
        runManifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    const stringRecord = (value) => Object.fromEntries(Object.entries(value && typeof value === "object"
        ? value
        : {}).filter((entry) => typeof entry[1] === "string"));
    const patchHashes = stringRecord(runManifest.patch_hashes);
    const caseHashes = stringRecord(runManifest.case_hashes);
    const costFor = (variant, matching) => {
        const price = e.pricing?.[variant];
        if (!price)
            return "unavailable";
        return matching.reduce((total, cell) => total +
            (cell.input_tokens * price.input_per_million +
                cell.output_tokens * price.output_per_million) /
                1_000_000, 0);
    };
    const variants = e.variants.map((v) => {
        const summary = summarize(cells, v.id);
        const matching = cells.filter((cell) => cell.variant === v.id);
        return { ...summary, cost: costFor(v.id, matching) };
    });
    const baseline = e.baseline ?? e.variants[0]?.id ?? "";
    const caseNames = [...new Set(cells.map((c) => c.case))].sort();
    const per_case = e.variants.flatMap((v) => caseNames.map((c) => {
        const matching = cells.filter((cell) => cell.variant === v.id && cell.case === c);
        return { ...summarize(cells, v.id, c), cost: costFor(v.id, matching) };
    }));
    const base = variants.find((v) => v.variant === baseline) ?? variants[0];
    const comparisons = variants
        .filter((v) => v.variant !== baseline)
        .map((v) => ({
        variant: v.variant,
        pass_rate_delta_pp: (v.pass_rate - base.pass_rate) * 100,
        median_token_delta_pct: base.median_tokens === 0
            ? v.median_tokens === 0
                ? 0
                : null
            : pct(v.median_tokens, base.median_tokens),
    }));
    const per_case_comparisons = caseNames.flatMap((caseName) => {
        const baseCase = per_case.find((row) => row.variant === baseline && row.case === caseName);
        return per_case
            .filter((row) => row.variant !== baseline && row.case === caseName)
            .map((row) => ({
            variant: row.variant,
            case: caseName,
            pass_rate_delta_pp: (row.pass_rate - baseCase.pass_rate) * 100,
            median_token_delta_pct: baseCase.median_tokens === 0
                ? row.median_tokens === 0
                    ? 0
                    : null
                : pct(row.median_tokens, baseCase.median_tokens),
        }));
    });
    const front = e.pricing
        ? pareto(variants.filter((x) => typeof x.cost === "number"), (x) => x.pass_rate, (x) => x.cost, (x) => x.median_duration_ms).map((x) => x.variant)
        : [];
    const qualityCost = e.pricing
        ? pareto(variants.filter((x) => typeof x.cost === "number"), (x) => x.pass_rate, (x) => x.cost, () => 0).map((x) => x.variant)
        : [];
    const qualityLatency = pareto(variants, (x) => x.pass_rate, () => 0, (x) => x.median_duration_ms).map((x) => x.variant);
    const data = {
        $schema: "schemas/report.schema.json",
        version: 1,
        experiment: e.name,
        baseline,
        incomplete: state.incomplete ||
            cells.some((c) => c.status === "error" || c.status === "cancelled"),
        manifest: {
            variants: e.variants.map((v) => v.id),
            repetitions: e.repetitions,
            input_hash: String(runManifest.input_hash ?? "unavailable"),
            workspace_hash: String(runManifest.workspace_hash ?? "unavailable"),
            judge_hash: String(runManifest.judge_hash ?? "unavailable"),
            case_hashes: caseHashes,
            patch_hashes: patchHashes,
            env_names: [...(e.run?.env_allowlist ?? [])].sort(),
        },
        variants,
        per_case,
        comparisons,
        per_case_comparisons,
        pareto: front,
        pareto_quality_cost: qualityCost,
        pareto_quality_latency: qualityLatency,
        cells: sanitize([...cells].sort((a, b) => a.id.localeCompare(b.id))),
    };
    await put(path.join(dir, "report.json"), JSON.stringify(data, null, 2) + "\n");
    const failed = cells
        .filter((cell) => cell.status !== "pass")
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((cell) => `- ${cell.variant}/${cell.case}/${cell.repetition}: ${cell.status}${cell.assertion_failures?.length ? ` (${cell.assertion_failures.join(", ")})` : ""}`);
    const comparisonLines = (rows) => rows.length
        ? rows
            .map((v) => `- ${v.variant}: pass ${v.pass_rate_delta_pp.toFixed(2)} pp; median tokens ${typeof v.median_token_delta_pct === "number" ? `${v.median_token_delta_pct.toFixed(2)}%` : "unavailable"}`)
            .join("\n")
        : "None";
    const md = `# ${e.name}\n\nBaseline: ${baseline}\nIncomplete: ${data.incomplete}\nInput hash: ${data.manifest.input_hash}\n\n| Variant | Pass | Fail | Error | Pass rate | Median tokens | Median ms | Cost |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${variants.map((v) => `| ${v.variant} | ${v.pass}/${v.total} | ${v.fail} | ${v.error} | ${(v.pass_rate * 100).toFixed(2)}% | ${v.median_tokens} | ${v.median_duration_ms} | ${v.cost} |`).join("\n")}\n\n## Baseline comparisons\n\n${comparisonLines(comparisons)}\n\n## Per case\n\n${per_case.map((v) => `- ${v.variant}/${v.case ?? ""}: ${v.pass}/${v.total} pass; ${v.error} error; cost ${v.cost}`).join("\n")}\n\n## Per-case comparisons\n\n${per_case_comparisons.length ? per_case_comparisons.map((v) => `- ${v.variant}/${v.case}: pass ${v.pass_rate_delta_pp.toFixed(2)} pp; median tokens ${typeof v.median_token_delta_pct === "number" ? `${v.median_token_delta_pct.toFixed(2)}%` : "unavailable"}`).join("\n") : "None"}\n\n## Pareto\n\n- Quality/cost: ${qualityCost.join(", ") || "unavailable"}\n- Quality/latency: ${qualityLatency.join(", ") || "unavailable"}\n\n## Failures\n\n${failed.length ? failed.join("\n") : "None"}\n\n## Reproduce\n\n\`dsh-profile-lab run <experiment.yml> --output <result-directory>\`\n\`dsh-profile-lab compare <result-directory>\`\n`;
    await put(path.join(dir, "report.md"), md);
    await put(path.join(dir, "report.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(e.name)}</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 24px;color:#1b1f23}h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}code,pre{background:#f6f8fa;padding:2px 5px}pre{padding:16px;overflow:auto}</style><body><h1>${esc(e.name)}</h1><p><strong>Baseline:</strong> ${esc(baseline)}<br><strong>Incomplete:</strong> ${data.incomplete}<br><strong>Input hash:</strong> <code>${esc(data.manifest.input_hash)}</code></p><h2>Variants</h2><table><thead><tr><th>Variant</th><th>Pass</th><th>Fail</th><th>Error</th><th>Pass rate</th><th>Median tokens</th><th>Median ms</th><th>Cost</th></tr></thead><tbody>${variants.map((v) => `<tr><td>${esc(v.variant)}</td><td>${v.pass}/${v.total}</td><td>${v.fail}</td><td>${v.error}</td><td>${(v.pass_rate * 100).toFixed(2)}%</td><td>${v.median_tokens}</td><td>${v.median_duration_ms}</td><td>${v.cost}</td></tr>`).join("")}</tbody></table><h2>Baseline comparisons</h2><pre>${esc(comparisonLines(comparisons))}</pre><h2>Per case</h2><pre>${esc(per_case.map((v) => `${v.variant}/${v.case ?? ""}: ${v.pass}/${v.total} pass; ${v.error} error; cost ${v.cost}`).join("\n") || "None")}</pre><h2>Per-case comparisons</h2><pre>${esc(per_case_comparisons.map((v) => `${v.variant}/${v.case}: pass ${v.pass_rate_delta_pp.toFixed(2)} pp; median tokens ${typeof v.median_token_delta_pct === "number" ? `${v.median_token_delta_pct.toFixed(2)}%` : "unavailable"}`).join("\n") || "None")}</pre><h2>Pareto</h2><pre>${esc(`Quality/cost: ${qualityCost.join(", ") || "unavailable"}\nQuality/latency: ${qualityLatency.join(", ") || "unavailable"}`)}</pre><h2>Failures</h2><pre>${esc(failed.length ? failed.join("\n") : "None")}</pre></body></html>`);
    return data;
};
