import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { zstdCompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  parseSessionBuffer,
  projectCell,
  readSession,
} from "../src/dsh-adapter/index.js";

const jsonl =
  [
    JSON.stringify({
      type: "assistant/message",
      seq: 1,
      time: "2026-08-18T00:00:00Z",
      data: {
        content: [{ type: "text", text: "accepted" }],
        usage: { input: 3, output: 5, reasoning: 2, cacheRead: 7 },
      },
    }),
    JSON.stringify({
      type: "tool/call",
      seq: 2,
      time: "2026-08-18T00:00:01Z",
      data: { id: "c1", name: "read", arguments: { path: "a" } },
    }),
    JSON.stringify({
      type: "tool/result",
      seq: 3,
      time: "2026-08-18T00:00:02Z",
      data: { call_id: "c1", result: "ok" },
    }),
    JSON.stringify({
      type: "turn/end",
      seq: 4,
      time: "2026-08-18T00:00:03Z",
      data: { reason: { kind: "completed" }, duration_ms: 12, steps: 1 },
    }),
  ].join("\n") + "\n";

describe("zstd official event fixtures", () => {
  it("projects JSONL and zstd fixtures identically", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "dsh-zstd-"));
    const plain = path.join(dir, "session.jsonl");
    const compressed = path.join(dir, "session.zst");
    await writeFile(plain, jsonl);
    await writeFile(compressed, zstdCompressSync(Buffer.from(jsonl)));
    const [a, b] = await Promise.all([
      readSession(plain),
      readSession(compressed),
    ]);
    const id = { id: "cell", variant: "v", case: "c", repetition: 1 };
    const comparable = (cell: ReturnType<typeof projectCell>) => {
      const copy = { ...cell };
      delete copy.evidence;
      return copy;
    };
    expect(comparable(projectCell(id, b, "zst"))).toEqual(
      comparable(projectCell(id, a, "jsonl")),
    );
  });

  it("marks corrupt zstd as incomplete rather than a pass", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "dsh-zstd-corrupt-"));
    const file = path.join(dir, "session.zst");
    await writeFile(file, Buffer.from("not a zstd frame"));
    const events = await readSession(file);
    expect(
      projectCell(
        { id: "cell", variant: "v", case: "c", repetition: 1 },
        events,
        "bad",
      ).status,
    ).toBe("error");
  });

  it("supports uncompressed buffers and records corrupted compressed buffers", () => {
    expect(parseSessionBuffer(Buffer.from(jsonl)).events).toHaveLength(4);
    expect(
      parseSessionBuffer(Buffer.from("invalid"), true).corrupt_frames,
    ).toBe(1);
  });

  it("retains legacy final events while projecting an aborted turn", () => {
    const cell = projectCell(
      { id: "legacy", variant: "v", case: "c", repetition: 1 },
      [
        { type: "assistant/final", text: "legacy" },
        { type: "turn/end", status: "aborted" },
      ],
      "legacy",
    );
    expect(cell.status).toBe("cancelled");
    expect(cell.final_output_hash).not.toBe("");
  });
});
