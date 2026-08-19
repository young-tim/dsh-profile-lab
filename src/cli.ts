#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import YAML from "yaml";
import { loadExperiment, loadResultExperiment } from "./config/index.js";
import { readRunState, run } from "./runner/index.js";
import { report } from "./report/index.js";
import { gateCandidates, validatePolicy } from "./gate/index.js";
const usage = (message: string): never => {
  throw new Error(`E_CONFIG: ${message}`);
};
const parse = (argv: string[]) => {
  const positional: string[] = [],
    options = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]!;
    if (!x.startsWith("--")) positional.push(x);
    else {
      if (
        ![
          "--check",
          "--driver",
          "--output",
          "--policy",
          "--tag",
          "--case",
          "--restart",
        ].includes(x) ||
        options.has(x)
      )
        usage(`invalid option ${x}`);
      if (x === "--restart") options.set(x, "true");
      else {
        const value = argv[++i];
        if (!value || value.startsWith("--")) usage(`missing value for ${x}`);
        options.set(x, value);
      }
    }
  }
  return { positional, options };
};
const rejectOptions = (options: Map<string, string>, allowed: string[]) => {
  for (const option of options.keys())
    if (!allowed.includes(option)) usage(`option ${option} is not valid here`);
};
export const main = async (argv: string[] = process.argv.slice(2)) => {
  const [command, ...rest] = argv;
  if (!command) usage("command required");
  const { positional, options } = parse(rest);
  if (command === "schema") {
    rejectOptions(options, ["--check"]);
    const check = options.get("--check");
    if (positional.length || !check) usage("schema requires --check FILE");
    await loadExperiment(check!);
    console.log("schema valid");
    return 0;
  }
  if (!["run", "compare", "gate"].includes(command))
    usage(`unknown command ${command}`);
  if (command === "run") {
    rejectOptions(options, [
      "--driver",
      "--output",
      "--tag",
      "--case",
      "--restart",
    ]);
    if (positional.length !== 1) usage("run requires one EXPERIMENT");
    const experiment = positional[0]!;
    const driver = options.get("--driver") ?? "dsh";
    if (!options.get("--output")) usage("run requires --output DIRECTORY");
    const output = options.get("--output")!;
    const e = await loadExperiment(experiment);
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    let done;
    try {
      done = await run(
        e,
        output,
        driver,
        experiment,
        {
          tags: options.get("--tag")?.split(","),
          names: options.get("--case")?.split(","),
        },
        options.has("--restart"),
        controller.signal,
      );
    } finally {
      process.removeListener("SIGINT", cancel);
    }
    console.log(`run complete: ${done.length} cells`);
    return (await readRunState(output)).incomplete ||
      done.some((c) => c.status === "error" || c.status === "cancelled")
      ? 3
      : 0;
  }
  rejectOptions(
    options,
    command === "compare" ? ["--check"] : ["--check", "--policy"],
  );
  if (positional.length !== 1) usage(`${command} requires one OUTPUT`);
  const output = positional[0]!;
  const cells = JSON.parse(
    await readFile(path.join(output!, "journal.json"), "utf8"),
  );
  const e = await loadResultExperiment(output, options.get("--check"));
  const result = await report(output!, e, cells);
  if (command === "compare") {
    console.log("reports written");
    return result.incomplete ? 3 : 0;
  }
  const policyFile = options.get("--policy");
  if (!policyFile) usage("gate requires --policy FILE");
  const policy = validatePolicy(
    YAML.parse(await readFile(policyFile!, "utf8")),
  );
  const base = result.variants.find((x) => x.variant === e.baseline);
  const candidates = result.variants.filter((x) => x.variant !== e.baseline);
  if (!base || !candidates.length) return 2;
  const verdicts = gateCandidates(base, candidates, policy);
  const reasons = verdicts.flatMap((verdict) =>
    verdict.reasons.map((reason) => `${verdict.variant}: ${reason}`),
  );
  if (result.incomplete) return 3;
  if (reasons.length) {
    console.error(reasons.join("; "));
    return 1;
  }
  console.log(JSON.stringify({ verdict: "pass", candidates: verdicts }));
  return 0;
};
const invoked = (() => {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
export const exitCodeForError = (error: unknown) =>
  String((error as Error).message).startsWith("E_RUN:") ? 3 : 2;
if (invoked)
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error((error as Error).message);
      process.exitCode = exitCodeForError(error);
    });
