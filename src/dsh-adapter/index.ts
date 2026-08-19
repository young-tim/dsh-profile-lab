import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { zstdDecompressSync } from "node:zlib";
import { decodeStorageRecord } from "@deepseek-ai/dsh-session";
import path from "node:path";
import type { Cell } from "../types.js";
export type SessionEvent = {
  type: string;
  seq?: number;
  time?: string | number;
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
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  duration_ms?: number;
  steps?: number;
  name?: string;
  error?: unknown;
  [key: string]: unknown;
};
const parseJsonlDetailed = (text: string) => {
  let corrupt_records = 0;
  const events = text
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const x = JSON.parse(line) as unknown;
        return (decodeStorageRecord(x) as unknown as SessionEvent[]).filter(
          (event) => !!event && typeof event.type === "string",
        );
      } catch {
        corrupt_records++;
        return [];
      }
    });
  return { events, corrupt_records };
};
export const parseJsonl = (text: string): SessionEvent[] =>
  parseJsonlDetailed(text).events;
export type SessionRead = {
  events: SessionEvent[];
  corrupt_frames: number;
  corrupt_records: number;
};
export const parseSessionBuffer = (
  buffer: Buffer,
  compressed = false,
): SessionRead => {
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const offsets: number[] = [];
  if (compressed)
    for (let cursor = 0; cursor < buffer.length;) {
      const offset = buffer.indexOf(magic, cursor);
      if (offset < 0) break;
      offsets.push(offset);
      cursor = offset + magic.length;
    }
  const decodeFrames = (): SessionRead => {
    const events: SessionEvent[] = [];
    let corrupt_frames = 0;
    let corrupt_records = 0;
    for (let index = 0; index < offsets.length; index++) {
      const frame = buffer.subarray(offsets[index], offsets[index + 1]);
      try {
        const parsed = parseJsonlDetailed(
          zstdDecompressSync(frame).toString("utf8"),
        );
        events.push(...parsed.events);
        corrupt_records += parsed.corrupt_records;
      } catch {
        corrupt_frames++;
      }
    }
    return { events, corrupt_frames, corrupt_records };
  };
  if (offsets.length > 1) return decodeFrames();
  try {
    const parsed = parseJsonlDetailed(
      (compressed ? zstdDecompressSync(buffer) : buffer).toString("utf8"),
    );
    return { ...parsed, corrupt_frames: 0 };
  } catch (error) {
    if (!compressed) throw error;
    const result = decodeFrames();
    return { ...result, corrupt_frames: Math.max(1, result.corrupt_frames) };
  }
};
export const readSessionDetailed = async (file: string) =>
  parseSessionBuffer(
    await readFile(file),
    [".zst", ".zstd"].includes(path.extname(file)),
  );
export const readSession = async (file: string) =>
  (await readSessionDetailed(file)).events;
const data = (event: SessionEvent) => event.data ?? event;
const messageData = (event: SessionEvent) => {
  const payload = data(event);
  return payload.message && typeof payload.message === "object"
    ? (payload.message as Record<string, unknown>)
    : payload;
};
const usageNumbers = (raw: unknown) => {
  const usage =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  return {
    input: Number(usage.inputTokens ?? usage.input ?? 0),
    output: Number(usage.outputTokens ?? usage.output ?? 0),
    reasoning: Number(usage.reasoningTokens ?? usage.reasoning ?? 0),
    cacheRead: Number(
      usage.cacheReadTokens ?? usage.cacheRead ?? usage.cache ?? 0,
    ),
    cacheWrite: Number(usage.cacheWriteTokens ?? usage.cacheWrite ?? 0),
  };
};
export const tokenUsage = (events: SessionEvent[]) => {
  const byStep = new Map<string, ReturnType<typeof usageNumbers>>();
  const legacy: ReturnType<typeof usageNumbers>[] = [];
  events.forEach((event) => {
    const payload = data(event);
    const chunk =
      payload.chunk && typeof payload.chunk === "object"
        ? (payload.chunk as Record<string, unknown>)
        : undefined;
    const raw =
      chunk?.type === "usage"
        ? chunk.usage
        : event.type === "assistant/message"
          ? payload.usage
          : (payload.usage ?? event.usage);
    if (!raw) return;
    const turn = payload.turn;
    const step = payload.step;
    if (turn !== undefined && step !== undefined) {
      const key = `${turn}:${step}`;
      if (chunk?.type === "usage" || !byStep.has(key))
        byStep.set(key, usageNumbers(raw));
    } else legacy.push(usageNumbers(raw));
  });
  const rows = [...byStep.values(), ...legacy];
  return rows.reduce(
    (total, row) => ({
      input: total.input + row.input,
      output: total.output + row.output,
      reasoning: total.reasoning + row.reasoning,
      cacheRead: total.cacheRead + row.cacheRead,
      cacheWrite: total.cacheWrite + row.cacheWrite,
    }),
    { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
  );
};
export const finalOutput = (events: SessionEvent[]) => {
  const finalMessage = events.findLast((e) => e.type === "assistant/message");
  const payload = finalMessage
    ? messageData(finalMessage)
    : events.findLast((e) => e.type === "assistant/final");
  const content = payload?.content;
  if (Array.isArray(content))
    return content
      .filter(
        (x) =>
          x &&
          typeof x === "object" &&
          (x as Record<string, unknown>).type === "text",
      )
      .map((x) => String((x as Record<string, unknown>).text ?? ""))
      .join("");
  return String(payload?.text ?? "");
};
export const toolNames = (events: SessionEvent[]) => {
  const calls = events.filter((e) => e.type === "tool/call");
  const source = calls.length
    ? calls
    : events.filter((e) => e.type === "assistant/message");
  return source
    .filter((e) => e.type === "tool/call" || e.type === "assistant/message")
    .flatMap((e) => {
      const d = e.type === "assistant/message" ? messageData(e) : data(e);
      if (e.type === "tool/call")
        return [String(d.name ?? d.tool ?? "")].filter(Boolean);
      const content = d.content;
      return Array.isArray(content)
        ? content
            .filter((x) =>
              ["tool", "tool-call"].includes(
                String((x as Record<string, unknown>)?.type),
              ),
            )
            .map((x) => String((x as Record<string, unknown>).name ?? ""))
            .filter(Boolean)
        : [];
    });
};
export const projectCell = (
  id: Omit<
    Cell,
    | "status"
    | "duration_ms"
    | "steps"
    | "tool_calls"
    | "tool_errors"
    | "input_tokens"
    | "output_tokens"
    | "reasoning_tokens"
    | "cache_tokens"
    | "final_output_hash"
    | "evidence"
    | "attempts"
  >,
  events: SessionEvent[],
  evidence: string,
): Cell => {
  const identity = {
    id: id.id,
    variant: id.variant,
    case: id.case,
    repetition: id.repetition,
  };
  const end = events.findLast((x) => x.type === "turn/end");
  const endData = end ? data(end) : {};
  const reason =
    (endData.reason as Record<string, unknown> | undefined)?.kind ??
    endData.status ??
    end?.status;
  const { input, output, reasoning, cacheRead, cacheWrite } =
    tokenUsage(events);
  const final = finalOutput(events);
  const start = events.find((x) => x.type === "turn/start");
  const elapsed = (() => {
    if (typeof start?.time === "number" && typeof end?.time === "number")
      return Math.max(0, end.time - start.time);
    const first = Date.parse(String(start?.time ?? ""));
    const last = Date.parse(String(end?.time ?? ""));
    return Number.isFinite(first) && Number.isFinite(last)
      ? Math.max(0, last - first)
      : 0;
  })();
  const status: Cell["status"] = !end
    ? "error"
    : ["completed", "ok"].includes(String(reason))
      ? "pass"
      : ["aborted", "interrupted", "disposed", "cancelled"].includes(
            String(reason),
          )
        ? "cancelled"
        : String(reason) === "fail"
          ? "fail"
          : "error";
  return {
    ...identity,
    status,
    attempts: 1,
    duration_ms: Number(endData.duration_ms ?? end?.duration_ms ?? elapsed),
    steps: Number(
      endData.steps ??
        end?.steps ??
        events.filter((x) => x.type === "step/end").length,
    ),
    tool_calls:
      events.filter((x) => x.type === "tool/call").length ||
      toolNames(events).length,
    tool_errors: events.filter(
      (x) =>
        x.type === "tool/error" ||
        (x.type === "tool/result" && Boolean(data(x).error)),
    ).length,
    input_tokens: input,
    output_tokens: output,
    reasoning_tokens: reasoning,
    cache_tokens: cacheRead + cacheWrite,
    cache_read_tokens: cacheRead,
    cache_write_tokens: cacheWrite,
    final_output_hash: createHash("sha256").update(final).digest("hex"),
    evidence,
    turn_reason: String(reason ?? "missing"),
  };
};
