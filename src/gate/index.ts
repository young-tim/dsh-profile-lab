import type { GatePolicy, Summary } from "../types.js";
const policyKeys = new Set([
  "min_candidate_pass_rate",
  "max_pass_rate_drop_pp",
  "max_median_token_increase_pct",
  "max_error_rate",
]);
export const validatePolicy = (value: unknown): GatePolicy => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("E_CONFIG: policy must be an object");
  const policy = value as Record<string, unknown>;
  for (const [key, raw] of Object.entries(policy)) {
    if (!policyKeys.has(key))
      throw new Error(`E_CONFIG: unknown policy field: ${key}`);
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0)
      throw new Error(`E_CONFIG: invalid policy value: ${key}`);
    if (["min_candidate_pass_rate", "max_error_rate"].includes(key) && raw > 1)
      throw new Error(`E_CONFIG: invalid policy value: ${key}`);
    if (key === "max_pass_rate_drop_pp" && raw > 100)
      throw new Error(`E_CONFIG: invalid policy value: ${key}`);
  }
  return policy as GatePolicy;
};
export const gate = (base: Summary, candidate: Summary, policy: GatePolicy) => {
  const reasons: string[] = [];
  if (
    policy.min_candidate_pass_rate !== undefined &&
    candidate.pass_rate < policy.min_candidate_pass_rate
  )
    reasons.push("candidate pass rate below minimum");
  if (
    policy.max_pass_rate_drop_pp !== undefined &&
    (base.pass_rate - candidate.pass_rate) * 100 > policy.max_pass_rate_drop_pp
  )
    reasons.push("pass rate drop exceeds policy");
  if (
    policy.max_median_token_increase_pct !== undefined &&
    base.median_tokens > 0 &&
    ((candidate.median_tokens - base.median_tokens) / base.median_tokens) *
      100 >
      policy.max_median_token_increase_pct
  )
    reasons.push("median token increase exceeds policy");
  if (
    policy.max_error_rate !== undefined &&
    candidate.error_rate > policy.max_error_rate
  )
    reasons.push("error rate exceeds policy");
  return reasons;
};
export const gateCandidates = (
  base: Summary,
  candidates: Summary[],
  policy: GatePolicy,
) =>
  candidates.map((candidate) => ({
    variant: candidate.variant,
    reasons: gate(base, candidate, policy),
  }));
