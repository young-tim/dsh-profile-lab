import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
export const parseJsonl = (text: string): SessionEvent[] =>
  text
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const x = JSON.parse(line);
        return x && typeof x.type === "string" ? [x as SessionEvent] : [];
      } catch {
        return [];
      }
    });
export const readSession = async (file: string) =>
  parseJsonl(await readFile(file, "utf8"));
const data = (event: SessionEvent) => event.data ?? event;
export const finalOutput = (events: SessionEvent[]) => {
  const message = events.findLast((e) => e.type === "assistant/message");
  const payload = message
    ? data(message)
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
export const toolNames = (events: SessionEvent[]) =>
  events
    .filter((e) => e.type === "tool/call" || e.type === "assistant/message")
    .flatMap((e) => {
      const d = data(e);
      if (e.type === "tool/call")
        return [String(d.name ?? d.tool ?? "")].filter(Boolean);
      const content = d.content;
      return Array.isArray(content)
        ? content
            .filter((x) => (x as Record<string, unknown>)?.type === "tool")
            .map((x) => String((x as Record<string, unknown>).name ?? ""))
            .filter(Boolean)
        : [];
    });
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
  const end = events.findLast((x) => x.type === "turn/end");
  const endData = end ? data(end) : {};
  const reason =
    (endData.reason as Record<string, unknown> | undefined)?.kind ??
    endData.status ??
    end?.status;
  let input = 0,
    output = 0,
    reasoning = 0,
    cache = 0;
  const seenUsage = new Set<number>();
  events.forEach((event, index) => {
    const u = (data(event).usage ?? event.usage) as SessionEvent["usage"];
    if (!u || seenUsage.has(index)) return;
    seenUsage.add(index);
    input += Number(u.input ?? 0);
    output += Number(u.output ?? 0);
    reasoning += Number(u.reasoning ?? 0);
    cache += Number(u.cache ?? u.cacheRead ?? 0) + Number(u.cacheWrite ?? 0);
  });
  const final = finalOutput(events);
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
    ...id,
    status,
    attempts: 1,
    duration_ms: Number(endData.duration_ms ?? end?.duration_ms ?? 0),
    steps: Number(
      endData.steps ??
        end?.steps ??
        events.filter((x) => x.type === "step/end").length,
    ),
    tool_calls:
      events.filter((x) => x.type === "tool/call").length +
      events
        .filter((x) => x.type === "assistant/message")
        .reduce((n, x) => n + toolNames([x]).length, 0),
    tool_errors: events.filter((x) => x.type === "tool/error").length,
    input_tokens: input,
    output_tokens: output,
    reasoning_tokens: reasoning,
    cache_tokens: cache,
    final_output_hash: createHash("sha256").update(final).digest("hex"),
    evidence,
    turn_reason: String(reason ?? "missing"),
  };
};
