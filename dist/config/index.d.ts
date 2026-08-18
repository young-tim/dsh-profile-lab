import type { Case, Experiment } from "../types.js";
export declare const hash: (data: string | Buffer) => string;
export declare const resolveInput: (experimentFile: string, relative: string) => string;
export declare const loadExperiment: (file: string) => Promise<Experiment>;
export declare const loadCases: (experimentFile: string, experiment: Experiment, filters?: {
    tags?: string[];
    names?: string[];
}) => Promise<Case[]>;
export declare const containedRealpath: (root: string, target: string) => Promise<string>;
