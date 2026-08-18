import type { Cell } from "../types.js";
export type SessionEvent = {
    type: string;
    seq?: number;
    time?: string;
    data?: Record<string, unknown>;
    status?: string;
    text?: string;
    usage?: {
        input?: number;
        output?: number;
        reasoning?: number;
        cache?: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
    duration_ms?: number;
    steps?: number;
    name?: string;
    error?: unknown;
    [key: string]: unknown;
};
export declare const parseJsonl: (text: string) => SessionEvent[];
export type SessionRead = {
    events: SessionEvent[];
    corrupt_frames: number;
};
export declare const parseSessionBuffer: (buffer: Buffer, compressed?: boolean) => SessionRead;
export declare const readSession: (file: string) => Promise<SessionEvent[]>;
export declare const finalOutput: (events: SessionEvent[]) => string;
export declare const toolNames: (events: SessionEvent[]) => string[];
export declare const projectCell: (id: Omit<Cell, "status" | "duration_ms" | "steps" | "tool_calls" | "tool_errors" | "input_tokens" | "output_tokens" | "reasoning_tokens" | "cache_tokens" | "final_output_hash" | "evidence" | "attempts">, events: SessionEvent[], evidence: string) => Cell;
