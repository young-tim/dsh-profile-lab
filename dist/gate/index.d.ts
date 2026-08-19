import type { GatePolicy, Summary } from "../types.js";
export declare const validatePolicy: (value: unknown) => GatePolicy;
export declare const gate: (base: Summary, candidate: Summary, policy: GatePolicy) => string[];
export declare const gateCandidates: (base: Summary, candidates: Summary[], policy: GatePolicy) => {
    variant: string;
    reasons: string[];
}[];
