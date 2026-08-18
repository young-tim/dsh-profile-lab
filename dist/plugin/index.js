import { defineTool } from "@deepseek-ai/dsh-tools";
import { loadExperiment } from "../config/index.js";
import { run } from "../runner/index.js";
import { report } from "../report/index.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const profile_lab_run = async (input) => {
    const experiment = await loadExperiment(input.experiment);
    return run(experiment, input.output, input.driver, input.experiment);
};
export const profile_lab_compare = async (input) => report(input.output, await loadExperiment(input.experiment), JSON.parse(await readFile(path.join(input.output, "journal.json"), "utf8")));
export const profile_lab_gate = async (input) => {
    if (!input?.policy)
        throw new Error("E_CONFIG: explicit policy required");
    const result = await profile_lab_compare(input);
    const experiment = await loadExperiment(input.experiment);
    const base = result.variants.find((x) => x.variant === experiment.baseline);
    const candidate = result.variants.find((x) => x.variant !== experiment.baseline);
    if (!base || !candidate)
        throw new Error("E_CONFIG: baseline missing");
    const { gate } = await import("../gate/index.js");
    return { reasons: gate(base, candidate, input.policy) };
};
export const name = "dsh-profile-lab";
export const inject = ["tools"];
const schema = {
    experiment: { type: "string", required: true },
    output: { type: "string", required: true },
    driver: { type: "string" },
    policy: { type: "object", additionalProperties: true },
};
const makeTool = defineTool;
const output = {
    schema: { type: "object", additionalProperties: true },
    render: (_args, value) => [
        { type: "text", text: JSON.stringify(value) },
    ],
};
export const apply = (ctx) => {
    ctx.tools.register(makeTool({
        name: "profile_lab_run",
        description: "Run an isolated DSH profile experiment.",
        parameters: schema,
        output,
        async execute(args) {
            return profile_lab_run(args);
        },
    }));
    ctx.tools.register(makeTool({
        name: "profile_lab_compare",
        description: "Generate deterministic reports for an experiment.",
        parameters: schema,
        output,
        async execute(args) {
            return profile_lab_compare(args);
        },
    }));
    ctx.tools.register(makeTool({
        name: "profile_lab_gate",
        description: "Evaluate a profile experiment policy gate.",
        parameters: schema,
        output,
        async execute(args) {
            return profile_lab_gate(args);
        },
    }));
};
export default apply;
