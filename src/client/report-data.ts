export interface ProfileLabVariantView {
  variant: string;
  total: number;
  pass: number;
  fail: number;
  error: number;
  pass_rate: number;
  error_rate: number;
  flaky: boolean;
  median_duration_ms: number;
  median_tokens: number;
  cost: number | "unavailable";
}

export interface ProfileLabCaseView extends ProfileLabVariantView {
  case: string;
}

export interface ProfileLabComparisonView {
  variant: string;
  pass_rate_delta_pp: number;
  median_token_delta_pct: number | null;
}

export interface ProfileLabReportView {
  version: 1;
  experiment: string;
  baseline: string;
  incomplete: boolean;
  compositions?: Array<{
    variant: string;
    profile: string;
    patch: string;
    layers: Array<{ id: string; keys: string[]; detail?: unknown }>;
  }>;
  variants: ProfileLabVariantView[];
  per_case: ProfileLabCaseView[];
  comparisons: ProfileLabComparisonView[];
  pareto_quality_cost: string[];
  pareto_quality_latency: string[];
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const reportShape = (value: unknown): value is ProfileLabReportView =>
  record(value) &&
  value.version === 1 &&
  typeof value.experiment === "string" &&
  typeof value.baseline === "string" &&
  typeof value.incomplete === "boolean" &&
  (value.compositions === undefined || Array.isArray(value.compositions)) &&
  Array.isArray(value.variants) &&
  value.variants.every(
    (variant) =>
      record(variant) &&
      typeof variant.variant === "string" &&
      typeof variant.pass_rate === "number" &&
      typeof variant.median_duration_ms === "number" &&
      typeof variant.median_tokens === "number",
  ) &&
  Array.isArray(value.per_case) &&
  Array.isArray(value.comparisons) &&
  Array.isArray(value.pareto_quality_cost) &&
  Array.isArray(value.pareto_quality_latency);

const reportTools = new Set(["profile_lab_run", "profile_lab_compare"]);

/** Find the newest report produced by a Profile Lab run or compare call. */
export const extractLatestReport = (
  nodes: readonly unknown[],
): ProfileLabReportView | null => {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (!record(node) || node.kind !== "tool-result" || node.isError === true)
      continue;
    const call = node.call;
    if (!record(call) || !reportTools.has(String(call.name))) continue;
    const content = Array.isArray(node.content) ? node.content : [];
    for (const block of content) {
      if (
        !record(block) ||
        block.type !== "text" ||
        typeof block.text !== "string"
      )
        continue;
      try {
        const parsed: unknown = JSON.parse(block.text);
        if (reportShape(parsed)) return parsed;
      } catch {
        // A malformed or truncated historical tool result is not a report.
      }
    }
  }
  return null;
};
