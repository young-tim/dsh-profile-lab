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
    variants: ProfileLabVariantView[];
    per_case: ProfileLabCaseView[];
    comparisons: ProfileLabComparisonView[];
    pareto_quality_cost: string[];
    pareto_quality_latency: string[];
}
/** Find the newest successful profile_lab_compare result in a chat projection. */
export declare const extractLatestReport: (nodes: readonly unknown[]) => ProfileLabReportView | null;
