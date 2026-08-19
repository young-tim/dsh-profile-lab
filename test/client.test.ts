import { describe, expect, it } from "vitest";
import { extractLatestReport } from "../src/client/report-data.js";

const report = {
  version: 1,
  experiment: "routing-lab",
  baseline: "base",
  incomplete: false,
  variants: [
    {
      variant: "base",
      total: 5,
      pass: 5,
      fail: 0,
      error: 0,
      pass_rate: 1,
      error_rate: 0,
      flaky: false,
      median_duration_ms: 20,
      median_tokens: 30,
      cost: "unavailable",
    },
  ],
  per_case: [],
  comparisons: [],
  pareto_quality_cost: [],
  pareto_quality_latency: ["base"],
};

describe("analysis tab report projection", () => {
  it("selects the newest successful compare result", () => {
    const older = { ...report, experiment: "older" };
    expect(
      extractLatestReport([
        {
          kind: "tool-result",
          call: { name: "profile_lab_compare" },
          content: [{ type: "text", text: JSON.stringify(older) }],
        },
        {
          kind: "tool-result",
          call: { name: "unrelated" },
          content: [{ type: "text", text: JSON.stringify(report) }],
        },
        {
          kind: "tool-result",
          call: { name: "profile_lab_compare" },
          content: [{ type: "text", text: JSON.stringify(report) }],
        },
      ]),
    ).toEqual(report);
  });

  it("ignores errors, malformed JSON and incompatible payloads", () => {
    expect(
      extractLatestReport([
        {
          kind: "tool-result",
          call: { name: "profile_lab_compare" },
          content: [{ type: "text", text: "{" }],
        },
        {
          kind: "tool-result",
          call: { name: "profile_lab_compare" },
          content: [{ type: "text", text: '{"version":2}' }],
        },
        {
          kind: "tool-result",
          isError: true,
          call: { name: "profile_lab_compare" },
          content: [{ type: "text", text: JSON.stringify(report) }],
        },
      ]),
    ).toBeNull();
  });
});
