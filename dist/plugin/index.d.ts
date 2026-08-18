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
    variants: import("../types.js").Summary[];
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
