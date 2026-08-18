import { describe, expect, it, vi } from "vitest";
import {
  evaluateCase,
  evaluateCaseWithJudge,
} from "../src/assertions/index.js";
import type { SessionEvent } from "../src/dsh-adapter/index.js";

const events: SessionEvent[] = [
  {
    type: "assistant/message",
    data: { content: [{ type: "text", text: "done" }] },
  },
  {
    type: "tool/call",
    data: { name: "read", arguments: { path: "safe.txt" } },
  },
  { type: "tool/result", data: { result: "contents" } },
  { type: "turn/end", data: { reason: { kind: "completed" } } },
];

describe("assertion engine advanced contracts", () => {
  it("evaluates tool argument and result containment", () => {
    expect(
      evaluateCase(
        {
          name: "x",
          prompt: "p",
          assert: {
            tool_args_contains: "safe.txt",
            tool_result_contains: "contents",
          },
        },
        events,
      ).ok,
    ).toBe(true);
    expect(
      evaluateCase(
        { name: "x", prompt: "p", assert: { tool_args_contains: "secret" } },
        events,
      ).failures[0]?.code,
    ).toBe("tool_args_contains");
  });
  it("does not call judge after a structural failure", async () => {
    const judge = vi.fn(async () => true);
    const result = await evaluateCaseWithJudge(
      {
        name: "x",
        prompt: "p",
        assert: { output_contains: "missing", output_judge: "quality" },
      },
      events,
      judge,
    );
    expect(result.ok).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });
  it("uses an opt-in judge only after structural success", async () => {
    const judge = vi.fn(async () => false);
    const result = await evaluateCaseWithJudge(
      { name: "x", prompt: "p", assert: { output_judge: "quality" } },
      events,
      judge,
    );
    expect(result.failures[0]?.code).toBe("output_judge");
    expect(judge).toHaveBeenCalledOnce();
  });
  it("reports a configured judge without an adapter", async () => {
    await expect(
      evaluateCaseWithJudge(
        { name: "x", prompt: "p", assert: { output_judge: "quality" } },
        events,
      ),
    ).resolves.toMatchObject({
      ok: false,
      failures: [{ code: "output_judge_unavailable" }],
    });
  });
});
