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
export declare const evaluateCase: (c: Case, events: SessionEvent[]) => AssertionResult;
export declare const assertCase: (c: Case, events: SessionEvent[]) => boolean;
