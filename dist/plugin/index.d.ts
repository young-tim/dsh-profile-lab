export declare const profile_lab_run: (input: {
    experiment: string;
    output: string;
    driver: string;
}) => Promise<import("../types.js").Cell[]>;
export declare const profile_lab_compare: (input: {
    experiment: string;
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
    };
    variants: ({
        cost: "unavailable";
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
    } | {
        cost: number;
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
    })[];
    per_case: import("../types.js").Summary[];
    comparisons: {
        variant: string;
        pass_rate_delta_pp: number;
        median_token_delta_pct: number;
    }[];
    pareto: string[];
    cells: import("../types.js").Cell[];
}>;
export declare const profile_lab_gate: (input?: {
    experiment: string;
    output: string;
    policy?: Record<string, unknown>;
}) => Promise<{
    verdict: string;
    reasons: string[];
}>;
export declare const name = "dsh-profile-lab";
export declare const inject: string[];
export declare const apply: (ctx: {
    tools: {
        register: (tool: unknown) => void;
    };
}) => void;
export default apply;
