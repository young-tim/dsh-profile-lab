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
export declare const name = "dsh-profile-lab";
export declare const inject: string[];
export declare const apply: (ctx: {
    tools: {
        register: (tool: unknown) => void;
    };
}) => void;
export default apply;
