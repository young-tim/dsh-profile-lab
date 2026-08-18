import type { Cell, Experiment } from '../types.js';
export declare const cells: (e: Experiment) => {
    id: string;
    variant: string;
    case: string;
    repetition: number;
}[];
export declare const run: (e: Experiment, base: string, driver: string) => Promise<Cell[]>;
