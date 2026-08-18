import type { Cell, Summary } from '../types.js';
export declare const quantile: (xs: number[], p: number) => number;
export declare const median: (xs: number[]) => number;
export declare const wilson: (success: number, total: number) => [number, number];
export declare const totalTokens: (c: Cell) => number;
export declare const summarize: (cells: Cell[], variant: string, caseName?: string) => Summary;
export declare const pct: (current: number, baseline: number) => number;
export declare const pareto: <T>(items: T[], quality: (x: T) => number, cost: (x: T) => number, latency: (x: T) => number) => T[];
