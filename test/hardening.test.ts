import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { main } from "../src/cli.js";
import {
  loadCases,
  loadExperiment,
  loadResultExperiment,
  validateExperiment,
} from "../src/config/index.js";
import { gate, validatePolicy } from "../src/gate/index.js";
import type { Experiment, Summary } from "../src/types.js";

const summary = (overrides: Partial<Summary> = {}): Summary => ({
  variant: "candidate",
  total: 5,
  pass: 5,
  fail: 0,
  error: 0,
  pass_rate: 1,
  error_rate: 0,
  flaky: false,
  median_duration_ms: 1,
  p95_duration_ms: 1,
  median_tokens: 10,
  p95_tokens: 10,
  median_steps: 1,
  p95_steps: 1,
  wilson: [0, 1],
  ...overrides,
});

describe("configuration hardening", () => {
  it("rejects an unknown credential mode", async () => {
    const experiment = await loadExperiment("examples/experiment.yml");
    await expect(
      validateExperiment({
        ...experiment,
        run: { ...experiment.run, credentials: "automatic" },
      }),
    ).rejects.toThrow("schema validation failed");
  });
  it.each([
    null,
    [],
    { unknown: 1 },
    { max_error_rate: "1" },
    { max_error_rate: Number.POSITIVE_INFINITY },
    { max_error_rate: -1 },
    { max_error_rate: 2 },
    { min_candidate_pass_rate: 2 },
    { max_pass_rate_drop_pp: 101 },
  ])("rejects invalid gate policy %#", (policy) => {
    expect(() => validatePolicy(policy)).toThrow("E_CONFIG");
  });

  it("enforces the median-token policy", () => {
    expect(
      gate(summary({ variant: "base" }), summary({ median_tokens: 20 }), {
        max_median_token_increase_pct: 10,
      }),
    ).toContain("median token increase exceeds policy");
    expect(
      gate(summary({ variant: "base", median_tokens: 0 }), summary(), {
        max_median_token_increase_pct: 0,
      }),
    ).toEqual([]);
  });

  it.each([
    "tags: invalid",
    "retries: -1",
    "assert: {turn_end: 1}",
    "assert: {max_steps: -1}",
    "assert: {no_tool_errors: invalid}",
    "assert: {output_judge: null}",
    "assert: {output_matches: [1]}",
  ])("rejects invalid case field: %s", async (extra) => {
    const root = await mkdtemp(path.join(tmpdir(), "case-hardening-"));
    await mkdir(path.join(root, "cases"));
    await writeFile(
      path.join(root, "cases", "case.yml"),
      `name: case\nprompt: test\n${extra}\n`,
    );
    const experiment = {
      ...(await loadExperiment("examples/experiment.yml")),
      cases_dir: "cases",
    } as Experiment;
    await expect(
      loadCases(path.join(root, "experiment.yml"), experiment),
    ).rejects.toThrow("E_CONFIG");
  });

  it("rejects missing and invalid result snapshots", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "result-hardening-"));
    await expect(loadResultExperiment(root)).rejects.toThrow("result manifest");
    await writeFile(path.join(root, "manifest.json"), '{"experiment":{}}');
    await expect(loadResultExperiment(root)).rejects.toThrow(
      "schema validation failed",
    );
  });
});

describe("CLI argument hardening", () => {
  it.each([
    [[], "command required"],
    [["schema"], "schema requires"],
    [["schema", "extra", "--check", "x"], "schema requires"],
    [["run", "examples/experiment.yml"], "run requires --output"],
    [["run", "x", "--output"], "missing value"],
    [["run", "x", "--wat", "y"], "invalid option"],
    [["run", "x", "--output", "a", "--output", "b"], "invalid option"],
    [["compare", "a", "b"], "compare requires one OUTPUT"],
    [["compare", "a", "--policy", "x"], "not valid here"],
  ] as const)("rejects %j", async (argv, message) => {
    await expect(main([...argv])).rejects.toThrow(message);
  });

  it("requires an explicit gate policy after loading a valid result", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "gate-hardening-"));
    const experiment = await loadExperiment("examples/experiment.yml");
    await writeFile(path.join(root, "journal.json"), "[]");
    await writeFile(
      path.join(root, "manifest.json"),
      JSON.stringify({ experiment }),
    );
    await expect(main(["gate", root])).rejects.toThrow(
      "gate requires --policy",
    );
  });
});
