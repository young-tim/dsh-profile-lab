import { describe, expect, it } from "vitest";
import { evaluateCase } from "../src/assertions/index.js";
import {
  finalOutput,
  parseJsonl,
  projectCell,
  toolNames,
} from "../src/dsh-adapter/index.js";
import { cells } from "../src/runner/index.js";
import { gate } from "../src/gate/index.js";
import { exitCodeForError, main } from "../src/cli.js";
import { loadExperiment } from "../src/config/index.js";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Experiment, Summary } from "../src/types.js";

const events = parseJsonl(
  '{"type":"assistant/message","data":{"content":[{"type":"text","text":"ready"},{"type":"tool","name":"read"}],"usage":{"input":2,"output":3}}}\n{"type":"step/end","data":{}}\n{"type":"turn/end","data":{"reason":{"kind":"completed"}}}\n',
);
const experiment: Experiment = {
  schema_version: 1,
  name: "x",
  cases_dir: "cases",
  workspace_template: "repo",
  baseline: "a",
  variants: [
    { id: "a", profile: "headless", patch: "a.yml" },
    { id: "b", profile: "headless", patch: "b.yml" },
  ],
  repetitions: 5,
  run: { concurrency: 2, timeout_ms: 100, max_runs: 20, max_total_tokens: 100 },
};
const summary = (pass_rate: number, error_rate = 0): Summary => ({
  variant: "v",
  total: 5,
  pass: 5,
  fail: 0,
  error: 0,
  pass_rate,
  error_rate,
  flaky: false,
  median_duration_ms: 10,
  p95_duration_ms: 10,
  median_tokens: 10,
  p95_tokens: 10,
  median_steps: 1,
  p95_steps: 1,
  wilson: [0, 1],
});

describe("official event projection", () => {
  it("projects envelope message content and usage", () =>
    expect(
      projectCell(
        { id: "x", variant: "a", case: "c", repetition: 1 },
        events,
        "e",
      ),
    ).toMatchObject({
      status: "pass",
      input_tokens: 2,
      output_tokens: 3,
      tool_calls: 1,
    }));
  it("keeps unknown events harmless", () =>
    expect(
      finalOutput([...events, { type: "unknown", data: { secret: "x" } }]),
    ).toBe("ready"));
  it("marks a missing durable end as error", () =>
    expect(
      projectCell(
        { id: "x", variant: "a", case: "c", repetition: 1 },
        events.slice(0, -1),
        "e",
      ).status,
    ).toBe("error"));
  it("recognizes tool content", () =>
    expect(toolNames(events)).toEqual(["read"]));
});

describe("assertion contract", () => {
  for (const [name, assertion, ok] of [
    ["turn end pass", { turn_end: "completed" }, true],
    ["turn end fail", { turn_end: "error" }, false],
    ["ordered tools pass", { tools_called: ["read"] }, true],
    ["ordered tools fail", { tools_called: ["write"] }, false],
    ["exact tools pass", { tools_exact: ["read"] }, true],
    ["exact tools fail", { tools_exact: [] }, false],
    ["forbidden pass", { tools_not_called: ["rm"] }, true],
    ["forbidden fail", { tools_not_called: ["read"] }, false],
    ["contains pass", { output_contains: "ready" }, true],
    ["contains fail", { output_contains: "missing" }, false],
    ["not contains pass", { output_not_contains: "bad" }, true],
    ["not contains fail", { output_not_contains: "ready" }, false],
    ["regex pass", { output_matches: "rea.*" }, true],
    ["regex fail", { output_matches: "^no$" }, false],
    ["regex invalid", { output_matches: "[" }, false],
    ["steps pass", { max_steps: 1 }, true],
    ["steps fail", { max_steps: 0 }, false],
    ["tokens pass", { max_tokens: 5 }, true],
    ["tokens fail", { max_tokens: 4 }, false],
    ["errors pass", { no_tool_errors: true }, true],
  ] as const)
    it(name, () =>
      expect(
        evaluateCase({ name, prompt: "p", assert: assertion }, events).ok,
      ).toBe(ok),
    );
});

describe("matrix and policy contract", () => {
  it("creates stable complete matrix", () => {
    const plan = cells(experiment, [
      { name: "first", prompt: "p" },
      { name: "second", prompt: "p" },
    ]);
    expect(plan).toHaveLength(20);
    expect(new Set(plan.map((x) => x.id)).size).toBe(20);
  });
  for (const [name, policy, expected] of [
    ["pass policy", {}, 0],
    ["minimum regression", { min_candidate_pass_rate: 0.8 }, 1],
    ["drop regression", { max_pass_rate_drop_pp: 10 }, 1],
    ["error regression", { max_error_rate: 0.1 }, 1],
    ["token regression", { max_median_token_increase_pct: 10 }, 1],
  ] as const)
    it(name, () => {
      const candidate =
        name === "token regression"
          ? { ...summary(1), median_tokens: 20 }
          : summary(
              name === "pass policy" ? 1 : 0.5,
              name === "error regression" ? 0.5 : 0,
            );
      expect(gate(summary(1), candidate, policy).length).toBe(expected);
    });
});

describe("parser boundaries", () => {
  for (const [input, count] of [
    ["", 0],
    ["\n", 0],
    ["{}", 0],
    ['{"type":1}', 0],
    ['{"type":"x"}', 1],
    ["bad", 0],
    ['{"type":"x"}\nbad', 1],
    ['{"type":"x"}\n{"type":"y"}', 2],
    ["null", 0],
    ["[]", 0],
    ['{"type":"assistant/message","data":{"content":[]}}', 1],
    ['{"type":"turn/end","data":{"reason":{"kind":"completed"}}}', 1],
  ] as const)
    it(`parses ${JSON.stringify(input)}`, () =>
      expect(parseJsonl(input)).toHaveLength(count));
});

describe("strict command and configuration boundaries", () => {
  for (const args of [
    [],
    ["wat"],
    ["run"],
    ["schema"],
    ["schema", "--check"],
    ["run", "examples/experiment.yml", "--driver"],
    ["compare"],
    ["gate"],
  ])
    it(`rejects ${args.join(" ")}`, async () =>
      await expect(main(args)).rejects.toThrow("E_CONFIG"));
  it("loads selected cases and rejects empty selection", async () => {
    const e = await loadExperiment("examples/experiment.yml");
    const { loadCases } = await import("../src/config/index.js");
    await expect(
      loadCases("examples/experiment.yml", e, { names: ["none"] }),
    ).rejects.toThrow("empty");
    expect(
      await loadCases("examples/experiment.yml", e, { tags: undefined }),
    ).toHaveLength(2);
  });
  it("accepts an explicit child environment allowlist", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "allowlist-"));
    await writeFile(
      path.join(root, "experiment.yml"),
      "schema_version: 1\nname: x\ncases_dir: cases\nworkspace_template: repo\nbaseline: a\nvariants: [{ id: a, profile: headless, patch: a.yml }, { id: b, profile: headless, patch: b.yml }]\nrepetitions: 1\nrun: { concurrency: 1, timeout_ms: 1, max_runs: 2, max_total_tokens: 0, env_allowlist: [SAFE_VALUE] }\n",
    );
    await expect(
      loadExperiment(path.join(root, "experiment.yml")),
    ).resolves.toMatchObject({ run: { env_allowlist: ["SAFE_VALUE"] } });
  });
  it("rejects a duplicate case before execution", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "duplicate-"));
    await mkdir(path.join(root, "cases"));
    await writeFile(
      path.join(root, "cases", "a.yml"),
      "name: duplicate\nprompt: x\n",
    );
    await writeFile(
      path.join(root, "cases", "b.yml"),
      "name: duplicate\nprompt: x\n",
    );
    const e = { ...experiment, cases_dir: "cases" };
    const { loadCases } = await import("../src/config/index.js");
    await expect(loadCases(path.join(root, "x.yml"), e)).rejects.toThrow(
      "duplicate",
    );
  });
  it("rejects unknown assertions and invalid regexes before dispatch", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "assert-contract-"));
    await mkdir(path.join(root, "cases"));
    const e = { ...experiment, cases_dir: "cases" };
    const { loadCases } = await import("../src/config/index.js");
    await writeFile(
      path.join(root, "cases", "x.yml"),
      "name: x\nprompt: x\nassert: { surprise: true }\n",
    );
    await expect(
      loadCases(path.join(root, "experiment.yml"), e),
    ).rejects.toThrow("unknown assert field");
    await writeFile(
      path.join(root, "cases", "x.yml"),
      "name: x\nprompt: x\nassert: { output_matches: '[' }\n",
    );
    await expect(
      loadCases(path.join(root, "experiment.yml"), e),
    ).rejects.toThrow("invalid output regex");
  });
});

describe("plugin service boundary", () => {
  it("maps infrastructure errors to exit code 3", () => {
    expect(exitCodeForError(new Error("E_RUN: broken"))).toBe(3);
    expect(exitCodeForError(new Error("E_CONFIG: broken"))).toBe(2);
  });
  it("returns real gate reasons through the plugin service", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "plugin-gate-"));
    await writeFile(path.join(out, "journal.json"), JSON.stringify([]));
    const { profile_lab_gate } = await import("../src/plugin/index.js");
    await expect(
      profile_lab_gate({
        experiment: "examples/experiment.yml",
        output: out,
        policy: { min_candidate_pass_rate: 1 },
      }),
    ).resolves.toMatchObject({ reasons: expect.any(Array) });
  });
  it("rejects plugin gates without policy", async () => {
    const { profile_lab_gate } = await import("../src/plugin/index.js");
    await expect(profile_lab_gate()).rejects.toThrow("explicit policy");
  });
});
