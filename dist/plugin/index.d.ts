export declare const profile_lab_run: (input: {
    experiment: string;
    output: string;
    driver: string;
}) => Promise<import("../types.js").Cell[]>;
export declare const profile_lab_compare: (input: {
    experiment: string;
    output: string;
}) => Promise<{
    version: number;
    experiment: string;
    variants: import("../types.js").Summary[];
    cells: import("../types.js").Cell[];
}>;
export declare const profile_lab_gate: () => Promise<never>;
export declare const apply: (ctx: {
    tool?: (name: string, fn: unknown) => void;
}) => void;
