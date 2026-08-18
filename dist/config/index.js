import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
const fail = (message) => {
    throw new Error(`E_CONFIG: ${message}`);
};
const object = (value, label) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
        fail(`${label} must be an object`);
    return value;
};
const keys = (value, allowed, label) => {
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            fail(`unknown ${label} field: ${key}`);
};
const safePath = (value, label) => {
    if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes(".."))
        fail(`invalid ${label} path`);
};
export const hash = (data) => createHash("sha256").update(data).digest("hex");
export const resolveInput = (experimentFile, relative) => path.resolve(path.dirname(experimentFile), relative);
export const loadExperiment = async (file) => {
    await readFile(new URL("../../schemas/experiment.schema.json", import.meta.url), "utf8"); // published schema is the validation contract
    const doc = YAML.parseDocument(await readFile(file, "utf8"), {
        uniqueKeys: true,
        merge: false,
        prettyErrors: false,
    });
    if (doc.errors.length || doc.warnings.length || doc.contents === null)
        fail(`invalid YAML: ${doc.errors.concat(doc.warnings).map(String).join("; ")}`);
    const x = object(doc.toJS(), "experiment");
    keys(x, [
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
    ], "top-level");
    if (x.schema_version !== 1 ||
        typeof x.name !== "string" ||
        !x.name ||
        typeof x.cases_dir !== "string" ||
        typeof x.workspace_template !== "string" ||
        typeof x.baseline !== "string" ||
        !Array.isArray(x.variants) ||
        x.variants.length < 2 ||
        !Number.isInteger(x.repetitions) ||
        Number(x.repetitions) < 1)
        fail("experiment contract invalid");
    const casesDir = x.cases_dir, workspaceTemplate = x.workspace_template, baseline = x.baseline, variantsRaw = x.variants;
    safePath(casesDir, "cases_dir");
    safePath(workspaceTemplate, "workspace_template");
    const ids = new Set();
    for (const raw of variantsRaw) {
        const v = object(raw, "variant");
        keys(v, ["id", "profile", "patch"], "variant");
        if (typeof v.id !== "string" ||
            !v.id ||
            typeof v.profile !== "string" ||
            !v.profile ||
            typeof v.patch !== "string" ||
            ids.has(v.id))
            fail("invalid or duplicate variant");
        safePath(v.patch, "patch");
        ids.add(v.id);
    }
    if (!ids.has(baseline))
        fail("baseline variant missing");
    const run = object(x.run, "run");
    keys(run, [
        "concurrency",
        "timeout_ms",
        "max_runs",
        "max_total_tokens",
        "env_allowlist",
    ], "run");
    if (!Number.isInteger(run.concurrency) ||
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
                run.env_allowlist.some((x) => typeof x !== "string"))))
        fail("invalid run settings");
    const experiment = x;
    if (experiment.variants.length * experiment.repetitions >
        experiment.run.max_runs)
        fail("max_runs exceeded");
    return experiment;
};
export const loadCases = async (experimentFile, experiment, filters = {}) => {
    const dir = resolveInput(experimentFile, experiment.cases_dir);
    const names = (await readdir(dir)).filter((x) => /\.ya?ml$/i.test(x)).sort();
    const result = [];
    const seen = new Set();
    for (const name of names) {
        const doc = YAML.parseDocument(await readFile(path.join(dir, name), "utf8"), { uniqueKeys: true, merge: false });
        if (doc.errors.length || doc.contents === null)
            fail(`invalid case ${name}`);
        const value = object(doc.toJS(), "case");
        keys(value, ["name", "prompt", "tags", "retries", "assert", "assertions"], "case");
        if (typeof value.name !== "string" ||
            !value.name ||
            typeof value.prompt !== "string" ||
            (value.tags !== undefined &&
                (!Array.isArray(value.tags) ||
                    value.tags.some((x) => typeof x !== "string"))) ||
            (value.retries !== undefined &&
                (!Number.isInteger(value.retries) || Number(value.retries) < 0)))
            fail(`invalid case ${name}`);
        const caseName = value.name;
        if (seen.has(caseName))
            fail(`duplicate case name: ${caseName}`);
        seen.add(caseName);
        result.push(value);
    }
    const filtered = result.filter((c) => (!filters.names || filters.names.includes(c.name)) &&
        (!filters.tags || filters.tags.some((t) => c.tags?.includes(t))));
    if (!filtered.length)
        fail("case selection is empty");
    return filtered;
};
export const containedRealpath = async (root, target) => {
    const [r, t] = await Promise.all([realpath(root), realpath(target)]);
    if (t !== r && !t.startsWith(r + path.sep))
        fail("path escapes root");
    return t;
};
