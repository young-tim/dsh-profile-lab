import type { Cell } from '../types.js';
export type SessionEvent = {
    type: string;
    status?: string;
    text?: string;
    usage?: {
        input?: number;
        output?: number;
        reasoning?: number;
        cache?: number;
    };
    duration_ms?: number;
    steps?: number;
    error?: unknown;
};
export declare const parseJsonl: (text: string) => SessionEvent[];
export declare const readSession: (file: string) => Promise<SessionEvent[]>;
export declare const projectCell: (id: Omit<Cell, "status" | "duration_ms" | "steps" | "tool_calls" | "tool_errors" | "input_tokens" | "output_tokens" | "reasoning_tokens" | "cache_tokens" | "final_output_hash" | "evidence" | "attempts">, events: SessionEvent[], evidence: string) => Cell;
