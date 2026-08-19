const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const reportShape = (value) => record(value) &&
    value.version === 1 &&
    typeof value.experiment === "string" &&
    typeof value.baseline === "string" &&
    typeof value.incomplete === "boolean" &&
    (value.compositions === undefined || Array.isArray(value.compositions)) &&
    Array.isArray(value.variants) &&
    value.variants.every((variant) => record(variant) &&
        typeof variant.variant === "string" &&
        typeof variant.pass_rate === "number" &&
        typeof variant.median_duration_ms === "number" &&
        typeof variant.median_tokens === "number") &&
    Array.isArray(value.per_case) &&
    Array.isArray(value.comparisons) &&
    Array.isArray(value.pareto_quality_cost) &&
    Array.isArray(value.pareto_quality_latency);
const reportTools = new Set(["profile_lab_run", "profile_lab_compare"]);
/** Find the newest report produced by a Profile Lab run or compare call. */
export const extractLatestReport = (nodes) => {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index];
        if (!record(node) || node.kind !== "tool-result" || node.isError === true)
            continue;
        const call = node.call;
        if (!record(call) || !reportTools.has(String(call.name)))
            continue;
        const content = Array.isArray(node.content) ? node.content : [];
        for (const block of content) {
            if (!record(block) ||
                block.type !== "text" ||
                typeof block.text !== "string")
                continue;
            try {
                const parsed = JSON.parse(block.text);
                if (reportShape(parsed))
                    return parsed;
            }
            catch {
                // A malformed or truncated historical tool result is not a report.
            }
        }
    }
    return null;
};
