import type { Experiment } from '../types.js';
export declare const hash: (data: string | Buffer) => string;
export declare const loadExperiment: (file: string) => Promise<Experiment>;
export declare const containedRealpath: (root: string, target: string) => Promise<string>;
