import { defineTool, } from "@deepseek-ai/dsh-tools";
import { loadExperiment, loadResultExperiment } from "../config/index.js";
import { run } from "../runner/index.js";
import { report } from "../report/index.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gateCandidates, validatePolicy } from "../gate/index.js";
export const profile_lab_run = async (input, signal) => {
    const experiment = await loadExperiment(input.experiment);
    const cells = await run(experiment, input.output, input.driver ?? "dsh", input.experiment, undefined, false, signal);
    return report(input.output, experiment, cells);
};
export const profile_lab_compare = async (input) => report(input.output, await loadResultExperiment(input.output, input.experiment), JSON.parse(await readFile(path.join(input.output, "journal.json"), "utf8")));
export const profile_lab_gate = async (input) => {
    if (!input?.policy)
        throw new Error("E_CONFIG: explicit policy required");
    const result = await profile_lab_compare(input);
    const experiment = await loadResultExperiment(input.output, input.experiment);
    const base = result.variants.find((x) => x.variant === experiment.baseline);
    const candidates = result.variants.filter((x) => x.variant !== experiment.baseline);
    const results = gateCandidates(base, candidates, validatePolicy(input.policy));
    const reasons = results.flatMap((result) => result.reasons.map((reason) => `${result.variant}: ${reason}`));
    if (result.incomplete)
        return {
            verdict: "incomplete",
            reasons: ["run is incomplete"],
            candidates: results,
        };
    return {
        verdict: reasons.length ? "regression" : "pass",
        reasons,
        candidates: results,
    };
};
export const name = "dsh-profile-lab";
export const inject = ["tools"];
const resultSchema = {
    experiment: {
        type: "string",
        description: "Optional experiment YAML file override. Omit this when reading a completed output directory.",
    },
    output: {
        type: "string",
        required: true,
        description: "Profile Lab result directory containing manifest.json and journal.json; this is a directory, not a file.",
    },
};
const output = {
    schema: { type: "json" },
    render: (_args, value) => [
        { type: "text", text: JSON.stringify(value) },
    ],
};
export const apply = (ctx) => {
    const active = new Set();
    const dispose = [
        ctx.tools.register(defineTool({
            name: "profile_lab_run",
            description: "Run an isolated DSH profile experiment and return its comparison report.",
            parameters: {
                experiment: { type: "string", required: true },
                output: {
                    type: "string",
                    required: true,
                    description: "New Profile Lab result directory for this run.",
                },
                driver: { type: "string" },
            },
            output,
            async execute(args, exec) {
                const controller = new AbortController();
                const abort = () => controller.abort();
                exec?.signal.addEventListener("abort", abort, { once: true });
                active.add(controller);
                try {
                    return await profile_lab_run(args, controller.signal);
                }
                finally {
                    active.delete(controller);
                    exec?.signal.removeEventListener("abort", abort);
                }
            },
        })),
        ctx.tools.register(defineTool({
            name: "profile_lab_compare",
            description: "Generate deterministic reports for an experiment.",
            parameters: resultSchema,
            output,
            async execute(args) {
                return profile_lab_compare(args);
            },
        })),
        ctx.tools.register(defineTool({
            name: "profile_lab_gate",
            description: "Evaluate a profile experiment policy gate.",
            parameters: {
                ...resultSchema,
                policy: { type: "json", required: true },
            },
            output,
            async execute(args) {
                if (!args.policy ||
                    typeof args.policy !== "object" ||
                    Array.isArray(args.policy))
                    throw new Error("E_CONFIG: policy must be an object");
                return profile_lab_gate({
                    ...args,
                    policy: args.policy,
                });
            },
        })),
    ];
    return () => {
        active.forEach((controller) => controller.abort());
        active.clear();
        dispose.forEach((unregister) => unregister());
    };
};
export default apply;
