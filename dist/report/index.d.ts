import type { Cell, Experiment } from '../types.js';
export declare const report: (dir: string, e: Experiment, cells: Cell[]) => Promise<{
    version: number;
    experiment: string;
    variants: import("../types.js").Summary[];
    cells: Cell[];
}>;
