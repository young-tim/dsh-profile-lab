import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
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
export const validateExperiment = async (raw: unknown): Promise<Experiment> => {
  const schema = JSON.parse(
    await readFile(
      new URL("../../schemas/experiment.schema.json", import.meta.url),
      "utf8",
    ),
  ) as object;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
    schema,
  );
  if (!validate(raw))
    fail(
      `schema validation failed: ${validate.errors
        ?.map((error) => `${error.instancePath || "/"} ${error.message}`)
        .join("; ")}`,
    );
  const experiment = raw as Experiment;
  safePath(experiment.cases_dir, "cases_dir");
  safePath(experiment.workspace_template, "workspace_template");
  const ids = new Set<string>();
  for (const variant of experiment.variants) {
    if (ids.has(variant.id)) fail("duplicate variant id");
    safePath(variant.patch, "patch");
    ids.add(variant.id);
  }
  if (!ids.has(experiment.baseline)) fail("baseline variant missing");
  if (experiment.judge) safePath(experiment.judge.command, "judge command");
  if (
    experiment.variants.length * experiment.repetitions >
    experiment.run.max_runs
  )
    fail("max_runs exceeded");
  return experiment;
};
export const loadExperiment = async (file: string): Promise<Experiment> => {
  const doc = YAML.parseDocument(await readFile(file, "utf8"), {
    uniqueKeys: true,
    merge: false,
    prettyErrors: false,
  });
  if (doc.errors.length || doc.warnings.length || doc.contents === null)
    fail(
      `invalid YAML: ${doc.errors.concat(doc.warnings).map(String).join("; ")}`,
    );
  let raw: unknown;
  try {
    raw = doc.toJS({ maxAliasCount: 0 }) as unknown;
  } catch (error) {
    fail(`invalid YAML: ${(error as Error).message}`);
  }
  return validateExperiment(raw);
};
export const loadResultExperiment = async (
  output: string,
  explicit?: string,
): Promise<Experiment> => {
  if (explicit) return loadExperiment(explicit);
  try {
    const manifest = JSON.parse(
      await readFile(path.join(output, "manifest.json"), "utf8"),
    ) as { experiment?: unknown };
    if (!manifest.experiment) throw new Error("missing experiment snapshot");
    return validateExperiment(manifest.experiment);
  } catch (error) {
    throw new Error(
      `E_CONFIG: result manifest is missing or invalid; provide an experiment (${(error as Error).message})`,
    );
  }
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
    if (doc.errors.length || doc.warnings.length || doc.contents === null)
      fail(`invalid case ${name}`);
    let caseValue: unknown;
    try {
      caseValue = doc.toJS({ maxAliasCount: 0 });
    } catch (error) {
      fail(`invalid case ${name}: ${(error as Error).message}`);
    }
    const value = object(caseValue, "case");
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
      const stringLists = [
        "tools_called",
        "called_tools",
        "tools_exact",
        "tools_not_called",
        "forbidden_tools",
        "output_contains",
        "output_not_contains",
        "tool_args_contains",
        "tool_result_contains",
      ];
      for (const key of stringLists) {
        const raw = assertion[key];
        if (
          raw !== undefined &&
          !(
            typeof raw === "string" ||
            (Array.isArray(raw) &&
              raw.every((item) => typeof item === "string"))
          )
        )
          fail(`invalid assertion ${key}`);
      }
      if (
        assertion.turn_end !== undefined &&
        typeof assertion.turn_end !== "string"
      )
        fail("invalid assertion turn_end");
      for (const key of ["max_steps", "max_tokens"]) {
        const raw = assertion[key];
        if (raw !== undefined && (!Number.isInteger(raw) || Number(raw) < 0))
          fail(`invalid assertion ${key}`);
      }
      if (
        assertion.no_tool_errors !== undefined &&
        typeof assertion.no_tool_errors !== "boolean"
      )
        fail("invalid assertion no_tool_errors");
      if (
        assertion.output_judge !== undefined &&
        !(
          typeof assertion.output_judge === "string" ||
          (!!assertion.output_judge &&
            typeof assertion.output_judge === "object" &&
            !Array.isArray(assertion.output_judge))
        )
      )
        fail("invalid assertion output_judge");
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
