import type { GatePolicy, Summary } from "../types.js";
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
