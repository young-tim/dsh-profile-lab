import type { Case, Cell, Experiment } from "../types.js";
export type Plan = {
    id: string;
    variant: string;
    case: string;
    repetition: number;
    source: Case;
};
export declare const cells: (e: Experiment, cases?: Case[]) => {
    id: string;
    variant: string;
    case: string;
    repetition: number;
    source: Case;
}[];
export declare const run: (e: Experiment, base: string, driver: string, experimentFile?: string, filters?: {
    tags?: string[];
    names?: string[];
}, restart?: boolean) => Promise<Cell[]>;
