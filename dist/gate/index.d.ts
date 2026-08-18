import type { GatePolicy, Summary } from "../types.js";
export declare const gate: (base: Summary, candidate: Summary, policy: GatePolicy) => string[];
