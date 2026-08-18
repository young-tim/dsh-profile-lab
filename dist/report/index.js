import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pareto, pct, summarize } from "../stats/index.js";
import { readRunState } from "../runner/index.js";
const esc = (x) => x.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const redact = (value) => value
    .replace(/\b(?:sk|ds|api)[_-][A-Za-z0-9_-]{8,}\b/gi, "[REDACTED]")
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]");
const sanitized = (value) => {
    if (typeof value === "string")
        return redact(value);
    if (Array.isArray(value))
        return value.map(sanitized);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            sanitized(item),
        ]));
    return value;
};
const put = async (file, text) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, text);
    await rename(`${file}.tmp`, file);
};
export const report = async (dir, e, cells) => {
    const state = await readRunState(dir);
    const variants = e.variants.map((v) => {
        const summary = summarize(cells, v.id);
        const price = e.pricing?.[v.id];
        if (!price)
            return { ...summary, cost: "unavailable" };
        const matching = cells.filter((cell) => cell.variant === v.id);
        return {
            ...summary,
            cost: matching.reduce((total, cell) => total +
                (cell.input_tokens * price.input_per_million +
                    cell.output_tokens * price.output_per_million) /
                    1_000_000, 0),
        };
    });
    const baseline = e.baseline ?? e.variants[0]?.id ?? "";
    const per_case = e.variants.flatMap((v) => [...new Set(cells.map((c) => c.case))]
        .sort()
        .map((c) => summarize(cells, v.id, c)));
    const base = variants.find((v) => v.variant === baseline) ?? variants[0];
    const comparisons = variants
        .filter((v) => v.variant !== baseline)
        .map((v) => ({
        variant: v.variant,
        pass_rate_delta_pp: (v.pass_rate - base.pass_rate) * 100,
        median_token_delta_pct: pct(v.median_tokens, base.median_tokens),
    }));
    const front = e.pricing
        ? pareto(variants.filter((x) => typeof x.cost === "number"), (x) => x.pass_rate, (x) => x.cost, (x) => x.median_duration_ms).map((x) => x.variant)
        : [];
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
        },
        variants,
        per_case,
        comparisons,
        pareto: front,
        cells: sanitized([...cells].sort((a, b) => a.id.localeCompare(b.id))),
    };
    await put(path.join(dir, "report.json"), JSON.stringify(data, null, 2) + "\n");
    const md = `# ${e.name}\n\nBaseline: ${baseline}\n\n| Variant | Pass rate | Median tokens |\n|---|---:|---:|\n${variants.map((v) => `| ${v.variant} | ${v.pass_rate} | ${v.median_tokens} |`).join("\n")}\n\n## Per case\n\n${per_case.map((v) => `- ${v.variant}/${v.case ?? ""}: ${v.pass}/${v.total} pass`).join("\n")}\n`;
    await put(path.join(dir, "report.md"), md);
    await put(path.join(dir, "report.html"), `<!doctype html><meta charset="utf-8"><title>${esc(e.name)}</title><pre>${esc(md)}</pre>`);
    return data;
};
