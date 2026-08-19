import type { Cell, Experiment } from "../types.js";
export { redact } from "../security/index.js";
export declare const report: (dir: string, e: Experiment, cells: Cell[]) => Promise<{
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
    cells: Cell[];
}>;
