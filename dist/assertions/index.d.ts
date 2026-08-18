import { type SessionEvent } from "../dsh-adapter/index.js";
import type { Case } from "../types.js";
export type AssertionResult = {
    ok: boolean;
    failures: {
        code: string;
        expected: unknown;
        actual: unknown;
    }[];
};
export type OutputJudge = (input: {
    prompt: string;
    output: string;
    rubric: unknown;
}) => Promise<boolean>;
export declare const evaluateCase: (c: Case, events: SessionEvent[]) => AssertionResult;
export declare const evaluateCaseWithJudge: (c: Case, events: SessionEvent[], judge?: OutputJudge) => Promise<AssertionResult>;
export declare const assertCase: (c: Case, events: SessionEvent[]) => boolean;
