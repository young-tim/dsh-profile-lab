#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { loadExperiment } from "./config/index.js";
import { readRunState, run } from "./runner/index.js";
import { report } from "./report/index.js";
import { gate } from "./gate/index.js";
const usage = (message) => {
    throw new Error(`E_CONFIG: ${message}`);
};
const parse = (argv) => {
    const positional = [], options = new Map();
    for (let i = 0; i < argv.length; i++) {
        const x = argv[i];
        if (!x.startsWith("--"))
            positional.push(x);
        else {
            if (![
                "--check",
                "--driver",
                "--output",
                "--policy",
                "--tag",
                "--case",
                "--restart",
            ].includes(x) ||
                options.has(x))
                usage(`invalid option ${x}`);
            if (x === "--restart")
                options.set(x, "true");
            else {
                const value = argv[++i];
                if (!value || value.startsWith("--"))
                    usage(`missing value for ${x}`);
                options.set(x, value);
            }
        }
    }
    return { positional, options };
};
export const main = async (argv = process.argv.slice(2)) => {
    const [command, ...rest] = argv;
    if (!command)
        usage("command required");
    const { positional, options } = parse(rest);
    if (command === "schema") {
        const check = options.get("--check");
        if (positional.length || !check)
            usage("schema requires --check FILE");
        await loadExperiment(check);
        console.log("schema valid");
        return 0;
    }
    if (!["run", "compare", "gate"].includes(command))
        usage(`unknown command ${command}`);
    const output = options.get("--output") ?? positional[0];
    if (!output)
        usage("output required");
    if (command === "run") {
        const experiment = positional[0];
        const driver = options.get("--driver");
        if (!experiment || !driver)
            usage("run requires EXPERIMENT and --driver DRIVER");
        const e = await loadExperiment(experiment);
        const done = await run(e, output, driver, experiment, {
            tags: options.get("--tag")?.split(","),
            names: options.get("--case")?.split(","),
        }, options.has("--restart"));
        console.log(`run complete: ${done.length} cells`);
        return (await readRunState(output)).incomplete ||
            done.some((c) => c.status === "error" || c.status === "cancelled")
            ? 3
            : 0;
    }
    const cells = JSON.parse(await readFile(path.join(output, "journal.json"), "utf8"));
    const experiment = options.get("--check") ?? "examples/experiment.yml";
    const e = await loadExperiment(experiment);
    const result = await report(output, e, cells);
    if (command === "compare") {
        console.log("reports written");
        return result.incomplete ? 3 : 0;
    }
    const policyFile = options.get("--policy");
    if (!policyFile)
        usage("gate requires --policy FILE");
    const policy = YAML.parse(await readFile(policyFile, "utf8"));
    const base = result.variants.find((x) => x.variant === e.baseline);
    const candidate = result.variants.find((x) => x.variant !== e.baseline);
    if (!base || !candidate)
        return 2;
    const reasons = gate(base, candidate, policy);
    if (result.incomplete)
        return 3;
    if (reasons.length) {
        console.error(reasons.join("; "));
        return 1;
    }
    console.log("gate passed");
    return 0;
};
const invoked = process.argv[1] &&
    (import.meta.url === new URL(process.argv[1], "file:").href ||
        import.meta.url.endsWith("/dist/cli.js"));
export const exitCodeForError = (error) => String(error.message).startsWith("E_RUN:") ? 3 : 2;
if (invoked)
    main()
        .then((code) => {
        process.exitCode = code;
    })
        .catch((error) => {
        console.error(error.message);
        process.exitCode = exitCodeForError(error);
    });
