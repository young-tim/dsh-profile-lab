import type { Cell, Experiment } from "../types.js";
export declare const report: (dir: string, e: Experiment, cells: Cell[]) => Promise<{
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
    cells: Cell[];
}>;
