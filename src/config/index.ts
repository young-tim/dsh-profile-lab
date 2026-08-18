import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { Case, Experiment } from "../types.js";

const fail = (message: string): never => {
  throw new Error(`E_CONFIG: ${message}`);
};
const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object`);
  return value as Record<string, unknown>;
};
const keys = (
  value: Record<string, unknown>,
  allowed: string[],
  label: string,
) => {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(`unknown ${label} field: ${key}`);
};
const safePath = (value: string, label: string) => {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes(".."))
    fail(`invalid ${label} path`);
};
export const hash = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
export const resolveInput = (experimentFile: string, relative: string) =>
  path.resolve(path.dirname(experimentFile), relative);
export const loadExperiment = async (file: string): Promise<Experiment> => {
  await readFile(
    new URL("../../schemas/experiment.schema.json", import.meta.url),
    "utf8",
  ); // published schema is the validation contract
  const doc = YAML.parseDocument(await readFile(file, "utf8"), {
    uniqueKeys: true,
    merge: false,
    prettyErrors: false,
  });
  if (doc.errors.length || doc.warnings.length || doc.contents === null)
    fail(
      `invalid YAML: ${doc.errors.concat(doc.warnings).map(String).join("; ")}`,
    );
  const x = object(doc.toJS(), "experiment");
  keys(
    x,
    [
      "schema_version",
      "name",
      "cases_dir",
      "workspace_template",
      "baseline",
      "variants",
      "repetitions",
      "run",
      "pricing",
      "gate",
    ],
    "top-level",
  );
  if (
    x.schema_version !== 1 ||
    typeof x.name !== "string" ||
    !x.name ||
    typeof x.cases_dir !== "string" ||
    typeof x.workspace_template !== "string" ||
    typeof x.baseline !== "string" ||
    !Array.isArray(x.variants) ||
    x.variants.length < 2 ||
    !Number.isInteger(x.repetitions) ||
    Number(x.repetitions) < 1
  )
    fail("experiment contract invalid");
  const casesDir = x.cases_dir as string,
    workspaceTemplate = x.workspace_template as string,
    baseline = x.baseline as string,
    variantsRaw = x.variants as unknown[];
  safePath(casesDir, "cases_dir");
  safePath(workspaceTemplate, "workspace_template");
  const ids = new Set<string>();
  for (const raw of variantsRaw) {
    const v = object(raw, "variant");
    keys(v, ["id", "profile", "patch"], "variant");
    if (
      typeof v.id !== "string" ||
      !v.id ||
      typeof v.profile !== "string" ||
      !v.profile ||
      typeof v.patch !== "string" ||
      ids.has(v.id)
    )
      fail("invalid or duplicate variant");
    safePath(v.patch as string, "patch");
    ids.add(v.id as string);
  }
  if (!ids.has(baseline)) fail("baseline variant missing");
  const run = object(x.run, "run");
  keys(
    run,
    [
      "concurrency",
      "timeout_ms",
      "max_runs",
      "max_total_tokens",
      "env_allowlist",
    ],
    "run",
  );
  if (
    !Number.isInteger(run.concurrency) ||
    Number(run.concurrency) < 1 ||
    Number(run.concurrency) > 8 ||
    !Number.isInteger(run.timeout_ms) ||
    Number(run.timeout_ms) < 1 ||
    !Number.isInteger(run.max_runs) ||
    Number(run.max_runs) < 1 ||
    !Number.isInteger(run.max_total_tokens) ||
    Number(run.max_total_tokens) < 0 ||
    (run.env_allowlist !== undefined &&
      (!Array.isArray(run.env_allowlist) ||
        run.env_allowlist.some((x) => typeof x !== "string")))
  )
    fail("invalid run settings");
  const experiment = x as unknown as Experiment;
  if (
    experiment.variants.length * experiment.repetitions >
    experiment.run.max_runs
  )
    fail("max_runs exceeded");
  return experiment;
};
export const loadCases = async (
  experimentFile: string,
  experiment: Experiment,
  filters: { tags?: string[]; names?: string[] } = {},
): Promise<Case[]> => {
  const dir = resolveInput(experimentFile, experiment.cases_dir);
  const names = (await readdir(dir)).filter((x) => /\.ya?ml$/i.test(x)).sort();
  const result: Case[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const doc = YAML.parseDocument(
      await readFile(path.join(dir, name), "utf8"),
      { uniqueKeys: true, merge: false },
    );
    if (doc.errors.length || doc.contents === null)
      fail(`invalid case ${name}`);
    const value = object(doc.toJS(), "case");
    keys(
      value,
      ["name", "prompt", "tags", "retries", "assert", "assertions"],
      "case",
    );
    if (
      typeof value.name !== "string" ||
      !value.name ||
      typeof value.prompt !== "string" ||
      (value.tags !== undefined &&
        (!Array.isArray(value.tags) ||
          value.tags.some((x) => typeof x !== "string"))) ||
      (value.retries !== undefined &&
        (!Number.isInteger(value.retries) || Number(value.retries) < 0))
    )
      fail(`invalid case ${name}`);
    const caseName = value.name as string;
    if (seen.has(caseName)) fail(`duplicate case name: ${caseName}`);
    seen.add(caseName);
    const assertions = value.assert ?? value.assertions;
    if (assertions !== undefined) {
      const assertion = object(assertions, "assert");
      keys(
        assertion,
        [
          "turn_end",
          "tools_called",
          "called_tools",
          "tools_exact",
          "tools_not_called",
          "forbidden_tools",
          "output_contains",
          "output_not_contains",
          "output_matches",
          "output_regex",
          "tool_args_contains",
          "tool_result_contains",
          "max_steps",
          "max_tokens",
          "no_tool_errors",
          "output_judge",
        ],
        "assert",
      );
      for (const pattern of [
        assertion.output_matches,
        assertion.output_regex,
      ]) {
        if (pattern === undefined) continue;
        const patterns = Array.isArray(pattern) ? pattern : [pattern];
        if (patterns.some((item) => typeof item !== "string"))
          fail("invalid output regex");
        try {
          patterns.forEach((item) => new RegExp(item as string));
        } catch {
          fail("invalid output regex");
        }
      }
    }
    result.push(value as Case);
  }
  const filtered = result.filter(
    (c) =>
      (!filters.names || filters.names.includes(c.name)) &&
      (!filters.tags || filters.tags.some((t) => c.tags?.includes(t))),
  );
  if (!filtered.length) fail("case selection is empty");
  return filtered;
};
export const containedRealpath = async (root: string, target: string) => {
  const [r, t] = await Promise.all([realpath(root), realpath(target)]);
  if (t !== r && !t.startsWith(r + path.sep)) fail("path escapes root");
  return t;
};
