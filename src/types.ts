export type Variant = { id: string; profile: string; patch: string };
export type RunSettings = { concurrency: number; timeout_ms: number; max_runs: number; max_total_tokens: number };
export type Experiment = { schema_version: 1; name: string; cases_dir: string; workspace_template: string; baseline: string; variants: Variant[]; repetitions: number; run: RunSettings; pricing?: Record<string, { input_per_million: number; output_per_million: number }>; gate?: GatePolicy };
export type Case = { name: string; prompt: string; tags?: string[]; retries?: number; assertions?: Record<string, unknown> };
export type CellStatus = 'pass' | 'fail' | 'error' | 'cancelled';
export type Cell = { id: string; variant: string; case: string; repetition: number; status: CellStatus; attempts: number; duration_ms: number; steps: number; tool_calls: number; tool_errors: number; input_tokens: number; output_tokens: number; reasoning_tokens: number; cache_tokens: number; final_output_hash: string; evidence: string };
export type GatePolicy = { min_candidate_pass_rate?: number; max_pass_rate_drop_pp?: number; max_median_token_increase_pct?: number; max_error_rate?: number };
export type Summary = { variant: string; case?: string; total: number; pass_rate: number; error_rate: number; flaky: boolean; repetition_label?: string; median_duration_ms: number; p95_duration_ms: number; median_tokens: number; p95_tokens: number; median_steps: number; p95_steps: number; wilson: [number, number] };
