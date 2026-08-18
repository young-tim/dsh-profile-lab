import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { zstdDecompressSync } from "node:zlib";
import path from "node:path";
export const parseJsonl = (text) => text
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
    try {
        const x = JSON.parse(line);
        return x && typeof x.type === "string" ? [x] : [];
    }
    catch {
        return [];
    }
});
export const parseSessionBuffer = (buffer, compressed = false) => {
    try {
        return {
            events: parseJsonl((compressed ? zstdDecompressSync(buffer) : buffer).toString("utf8")),
            corrupt_frames: 0,
        };
    }
    catch (error) {
        if (!compressed)
            throw error;
        return { events: [], corrupt_frames: 1 };
    }
};
export const readSession = async (file) => {
    const result = parseSessionBuffer(await readFile(file), [".zst", ".zstd"].includes(path.extname(file)));
    return result.events;
};
const data = (event) => event.data ?? event;
export const finalOutput = (events) => {
    const message = events.findLast((e) => e.type === "assistant/message");
    const payload = message
        ? data(message)
        : events.findLast((e) => e.type === "assistant/final");
    const content = payload?.content;
    if (Array.isArray(content))
        return content
            .filter((x) => x &&
            typeof x === "object" &&
            x.type === "text")
            .map((x) => String(x.text ?? ""))
            .join("");
    return String(payload?.text ?? "");
};
export const toolNames = (events) => events
    .filter((e) => e.type === "tool/call" || e.type === "assistant/message")
    .flatMap((e) => {
    const d = data(e);
    if (e.type === "tool/call")
        return [String(d.name ?? d.tool ?? "")].filter(Boolean);
    const content = d.content;
    return Array.isArray(content)
        ? content
            .filter((x) => x?.type === "tool")
            .map((x) => String(x.name ?? ""))
            .filter(Boolean)
        : [];
});
export const projectCell = (id, events, evidence) => {
    const identity = {
        id: id.id,
        variant: id.variant,
        case: id.case,
        repetition: id.repetition,
    };
    const end = events.findLast((x) => x.type === "turn/end");
    const endData = end ? data(end) : {};
    const reason = endData.reason?.kind ??
        endData.status ??
        end?.status;
    let input = 0, output = 0, reasoning = 0, cache = 0;
    const seenUsage = new Set();
    events.forEach((event, index) => {
        const u = (data(event).usage ?? event.usage);
        if (!u || seenUsage.has(index))
            return;
        seenUsage.add(index);
        input += Number(u.input ?? 0);
        output += Number(u.output ?? 0);
        reasoning += Number(u.reasoning ?? 0);
        cache += Number(u.cache ?? u.cacheRead ?? 0) + Number(u.cacheWrite ?? 0);
    });
    const final = finalOutput(events);
    const status = !end
        ? "error"
        : ["completed", "ok"].includes(String(reason))
            ? "pass"
            : ["aborted", "interrupted", "disposed", "cancelled"].includes(String(reason))
                ? "cancelled"
                : String(reason) === "fail"
                    ? "fail"
                    : "error";
    return {
        ...identity,
        status,
        attempts: 1,
        duration_ms: Number(endData.duration_ms ?? end?.duration_ms ?? 0),
        steps: Number(endData.steps ??
            end?.steps ??
            events.filter((x) => x.type === "step/end").length),
        tool_calls: events.filter((x) => x.type === "tool/call").length +
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
