import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gate } from "../src/gate/index.js";
import {
  parseJsonl,
  projectCell,
  readSession,
} from "../src/dsh-adapter/index.js";
import { report } from "../src/report/index.js";
import type { Cell, Experiment, Summary } from "../src/types.js";
const summary = (pass_rate: number, error_rate = 0): Summary => ({
  variant: "x",
  total: 5,
  pass_rate,
  error_rate,
  flaky: false,
  median_duration_ms: 1,
  p95_duration_ms: 1,
  median_tokens: 1,
  p95_tokens: 1,
  median_steps: 1,
  p95_steps: 1,
  wilson: [0, 1],
});
const cell = (variant: string): Cell => ({
  id: variant,
  variant,
  case: "x",
  repetition: 1,
  status: "pass",
  attempts: 1,
  duration_ms: 1,
  steps: 1,
  tool_calls: 0,
  tool_errors: 0,
  input_tokens: 1,
  output_tokens: 2,
  reasoning_tokens: 0,
  cache_tokens: 0,
  final_output_hash: "x",
  evidence: "x",
});
describe("decision services", () => {
  it("projects tolerant session logs", async () => {
    const text =
      '{"type":"tool/call"}\ninvalid\n{"type":"assistant/final","text":"<ok>"}\n{"type":"turn/end","status":"ok","duration_ms":3,"steps":2,"usage":{"input":4,"output":5}}\n';
    const d = await mkdtemp(path.join(tmpdir(), "event-"));
    const f = path.join(d, "s.jsonl");
    await writeFile(f, text);
    expect(parseJsonl(text)).toHaveLength(3);
    expect(await readSession(f)).toHaveLength(3);
    const x = projectCell(
      { id: "id", variant: "v", case: "c", repetition: 1 },
      parseJsonl(text),
      "e",
    );
    expect(x).toMatchObject({
      status: "pass",
      duration_ms: 3,
      steps: 2,
      input_tokens: 4,
      output_tokens: 5,
      tool_calls: 1,
    });
  });
  it("returns all policy reasons", () => {
    expect(
      gate(summary(0.9), summary(0.2, 0.2), {
        min_candidate_pass_rate: 0.8,
        max_pass_rate_drop_pp: 5,
        max_error_rate: 0.1,
      }),
    ).toHaveLength(3);
    expect(gate(summary(1), summary(1), {})).toEqual([]);
  });
  it("writes deterministic escaped reports", async () => {
    const d = await mkdtemp(path.join(tmpdir(), "report-"));
    const e = {
      name: "<unsafe>",
      variants: [{ id: "base" }, { id: "candidate" }],
    } as unknown as Experiment;
    await report(d, e, [cell("base"), cell("candidate")]);
    const a = await Promise.all(
      ["report.json", "report.md", "report.html"].map((f) =>
        readFile(path.join(d, f), "utf8"),
      ),
    );
    await report(d, e, [cell("base"), cell("candidate")]);
    expect(await readFile(path.join(d, "report.html"), "utf8")).toBe(a[2]);
    expect(a[2]).toContain("&lt;unsafe&gt;");
  });
});
describe("decision services", () => {
  it("projects tolerant session logs", async () => {
    const text =
      '{"type":"tool/call"}\ninvalid\n{"type":"assistant/final","text":"<ok>"}\n{"type":"turn/end","status":"ok","duration_ms":3,"steps":2,"usage":{"input":4,"output":5}}\n';
    const d = await mkdtemp(path.join(tmpdir(), "event-"));
    const f = path.join(d, "s.jsonl");
    await writeFile(f, text);
    expect(parseJsonl(text)).toHaveLength(3);
    expect(await readSession(f)).toHaveLength(3);
    const x = projectCell(
      { id: "id", variant: "v", case: "c", repetition: 1 },
      parseJsonl(text),
      "e",
    );
    expect(x).toMatchObject({
      status: "pass",
      duration_ms: 3,
      steps: 2,
      input_tokens: 4,
      output_tokens: 5,
      tool_calls: 1,
    });
    for (const status of ["cancelled", "fail", "weird"])
      expect(
        projectCell(
          { id: status, variant: "v", case: "c", repetition: 1 },
          [{ type: "turn/end", status }],
          "e",
        ).status,
      ).toBe(
        status === "cancelled"
          ? "cancelled"
          : status === "fail"
            ? "fail"
            : "error",
      );
  });
  it("returns all policy reasons", () => {
    expect(
      gate(summary(0.9), summary(0.2, 0.2), {
        min_candidate_pass_rate: 0.8,
        max_pass_rate_drop_pp: 5,
        max_error_rate: 0.1,
      }),
    ).toHaveLength(3);
    expect(gate(summary(1), summary(1), {})).toEqual([]);
  });
  it("writes deterministic escaped reports", async () => {
    const d = await mkdtemp(path.join(tmpdir(), "report-"));
    const e = {
      name: "<unsafe>",
      variants: [{ id: "base" }, { id: "candidate" }],
    } as unknown as Experiment;
    await report(d, e, [cell("base"), cell("candidate")]);
    const a = await Promise.all(
      ["report.json", "report.md", "report.html"].map((f) =>
        readFile(path.join(d, f), "utf8"),
      ),
    );
    await report(d, e, [cell("base"), cell("candidate")]);
    expect(await readFile(path.join(d, "report.html"), "utf8")).toBe(a[2]);
    expect(a[2]).toContain("&lt;unsafe&gt;");
  });
});
