import { type JsonValue, type ToolRuntime } from "@deepseek-ai/dsh-tools";
export declare const profile_lab_run: (input: {
    experiment: string;
    output: string;
    driver?: string;
}, signal?: AbortSignal) => Promise<{
    $schema: string;
    version: number;
    experiment: string;
    baseline: string;
    incomplete: boolean;
    manifest: {
        variants: string[];
        repetitions: number;
        input_hash: string;
        workspace_hash: string;
        judge_hash: string;
        case_hashes: {
            [k: string]: string;
        };
        patch_hashes: {
            [k: string]: string;
        };
        env_names: string[];
    };
    compositions: {
        variant: string;
        profile: string;
        patch: string;
        layers: {
            id: string;
            keys: string[];
            detail: JsonValue;
        }[];
    }[];
    variants: {
        cost: number | "unavailable";
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
    }[];
    per_case: {
        cost: number | "unavailable";
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
    }[];
    comparisons: {
        variant: string;
        pass_rate_delta_pp: number;
        median_token_delta_pct: number | null;
    }[];
    per_case_comparisons: {
        variant: string;
        case: string;
        pass_rate_delta_pp: number;
        median_token_delta_pct: number | null;
    }[];
    pareto: string[];
    pareto_quality_cost: string[];
    pareto_quality_latency: string[];
    cells: import("../types.js").Cell[];
}>;
export declare const profile_lab_compare: (input: {
    experiment?: string;
    output: string;
}) => Promise<{
    $schema: string;
    version: number;
    experiment: string;
    baseline: string;
    incomplete: boolean;
    manifest: {
        variants: string[];
        repetitions: number;
        input_hash: string;
        workspace_hash: string;
        judge_hash: string;
        case_hashes: {
            [k: string]: string;
        };
        patch_hashes: {
            [k: string]: string;
        };
        env_names: string[];
    };
    compositions: {
        variant: string;
        profile: string;
        patch: string;
        layers: {
            id: string;
            keys: string[];
            detail: JsonValue;
        }[];
    }[];
    variants: {
        cost: number | "unavailable";
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
    }[];
    per_case: {
        cost: number | "unavailable";
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
    }[];
    comparisons: {
        variant: string;
        pass_rate_delta_pp: number;
        median_token_delta_pct: number | null;
    }[];
    per_case_comparisons: {
        variant: string;
        case: string;
        pass_rate_delta_pp: number;
        median_token_delta_pct: number | null;
    }[];
    pareto: string[];
    pareto_quality_cost: string[];
    pareto_quality_latency: string[];
    cells: import("../types.js").Cell[];
}>;
export declare const profile_lab_gate: (input?: {
    experiment?: string;
    output: string;
    policy?: Record<string, unknown>;
}) => Promise<{
    verdict: string;
    reasons: string[];
    candidates: {
        variant: string;
        reasons: string[];
    }[];
}>;
export declare const name = "dsh-profile-lab";
export declare const inject: string[];
export declare const apply: (ctx: {
    tools: Pick<ToolRuntime, "register">;
}) => () => void;
export default apply;
