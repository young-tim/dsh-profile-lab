export type Variant = {
    id: string;
    profile: string;
    patch: string;
};
export type RunSettings = {
    concurrency: number;
    timeout_ms: number;
    max_runs: number;
    max_total_tokens: number;
    env_allowlist?: string[];
};
export type Assertion = Record<string, unknown>;
export type Case = {
    name: string;
    prompt: string;
    tags?: string[];
    retries?: number;
    assert?: Assertion;
    assertions?: Assertion;
};
export type GatePolicy = {
    min_candidate_pass_rate?: number;
    max_pass_rate_drop_pp?: number;
    max_median_token_increase_pct?: number;
    max_error_rate?: number;
};
export type Experiment = {
    schema_version: 1;
    name: string;
    cases_dir: string;
    workspace_template: string;
    baseline: string;
    variants: Variant[];
    repetitions: number;
    run: RunSettings;
    pricing?: Record<string, {
        input_per_million: number;
        output_per_million: number;
    }>;
    gate?: GatePolicy;
    judge?: {
        command: string;
        timeout_ms: number;
        env_allowlist?: string[];
    };
};
export type CellStatus = "pass" | "fail" | "error" | "cancelled";
export type Attempt = {
    attempt: number;
    status: CellStatus;
    duration_ms: number;
    evidence: string;
    turn_reason?: string;
    diagnostic?: string;
    input_tokens?: number;
    output_tokens?: number;
    reasoning_tokens?: number;
};
export type Cell = {
    id: string;
    variant: string;
    case: string;
    repetition: number;
    status: CellStatus;
    attempts: number;
    duration_ms: number;
    steps: number;
    tool_calls: number;
    tool_errors: number;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cache_tokens: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
    final_output_hash: string;
    evidence: string;
    corrupt_frames?: number;
    corrupt_records?: number;
    assertion_failures?: string[];
    turn_reason?: string;
    cost?: number;
    attempt_details?: Attempt[];
    judge?: {
        pass: boolean;
        reason?: string;
        input_tokens: number;
        output_tokens: number;
        reasoning_tokens: number;
        evidence: string;
    };
};
export type Summary = {
    variant: string;
    case?: string;
    total: number;
    pass: number;
    fail: number;
    error: number;
    pass_rate: number;
    error_rate: number;
    flaky: boolean;
    repetition_label?: string;
    median_duration_ms: number;
    p95_duration_ms: number;
    median_tokens: number;
    p95_tokens: number;
    median_steps: number;
    p95_steps: number;
    wilson: [number, number];
    cost?: number | "unavailable";
};
