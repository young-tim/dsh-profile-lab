import {
  defineTool,
  type JsonValue,
  type ToolRuntime,
} from "@deepseek-ai/dsh-tools";
import { loadExperiment } from "../config/index.js";
import { run } from "../runner/index.js";
import { report } from "../report/index.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const profile_lab_run = async (input: {
  experiment: string;
  output: string;
  driver: string;
}) => {
  const experiment = await loadExperiment(input.experiment);
  return run(experiment, input.output, input.driver, input.experiment);
};
export const profile_lab_compare = async (input: {
  experiment: string;
  output: string;
}) =>
  report(
    input.output,
    await loadExperiment(input.experiment),
    JSON.parse(await readFile(path.join(input.output, "journal.json"), "utf8")),
  );
export const profile_lab_gate = async (input?: {
  experiment: string;
  output: string;
  policy?: Record<string, unknown>;
}) => {
  if (!input?.policy) throw new Error("E_CONFIG: explicit policy required");
  const result = await profile_lab_compare(input);
  const experiment = await loadExperiment(input.experiment);
  const base = result.variants.find((x) => x.variant === experiment.baseline);
  const candidate = result.variants.find(
    (x) => x.variant !== experiment.baseline,
  );
  if (!base || !candidate) throw new Error("E_CONFIG: baseline missing");
  const { gate } = await import("../gate/index.js");
  const reasons = gate(base, candidate, input.policy);
  return { verdict: reasons.length ? "regression" : "pass", reasons };
};
export const name = "dsh-profile-lab";
export const inject = ["tools"];
const baseSchema = {
  experiment: { type: "string", required: true },
  output: { type: "string", required: true },
} as const;
const output = {
  schema: { type: "json" as const },
  render: (_args: unknown, value: JsonValue) => [
    { type: "text" as const, text: JSON.stringify(value) },
  ],
};
export const apply = (ctx: { tools: Pick<ToolRuntime, "register"> }) => {
  const dispose = [
    ctx.tools.register(
      defineTool({
        name: "profile_lab_run",
        description: "Run an isolated DSH profile experiment.",
        parameters: {
          ...baseSchema,
          driver: { type: "string" as const, required: true },
        },
        output,
        async execute(args) {
          return profile_lab_run(args);
        },
      }),
    ),
    ctx.tools.register(
      defineTool({
        name: "profile_lab_compare",
        description: "Generate deterministic reports for an experiment.",
        parameters: baseSchema,
        output,
        async execute(args) {
          return profile_lab_compare(args);
        },
      }),
    ),
    ctx.tools.register(
      defineTool({
        name: "profile_lab_gate",
        description: "Evaluate a profile experiment policy gate.",
        parameters: {
          ...baseSchema,
          policy: { type: "json" as const, required: true },
        },
        output,
        async execute(args) {
          if (
            !args.policy ||
            typeof args.policy !== "object" ||
            Array.isArray(args.policy)
          )
            throw new Error("E_CONFIG: policy must be an object");
          return profile_lab_gate({
            ...args,
            policy: args.policy as Record<string, unknown>,
          });
        },
      }),
    ),
  ];
  return () => dispose.forEach((unregister) => unregister());
};
export default apply;
