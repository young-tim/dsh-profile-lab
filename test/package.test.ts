import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "@deepseek-ai/dsh-tools";
import { apply, profile_lab_gate } from "../src/plugin/index.js";
const execute = promisify(execFile);
describe("package surface", () =>
  it("ships one bundle row and three executable tools", async () => {
    const patch = await readFile("cordis.patch.yml", "utf8");
    expect(patch).toContain("dsh-profile-lab");
    const tools: ToolDefinition[] = [];
    const dispose = apply({
      tools: {
        register: (tool) => {
          tools.push(tool);
          return () => tools.splice(tools.indexOf(tool), 1);
        },
      },
    });
    expect(tools).toHaveLength(3);
    const out = await mkdtemp(path.join(tmpdir(), "tool-"));
    await tools[0]!.execute({
      experiment: "examples/experiment.yml",
      output: out,
      driver: path.resolve("fixtures/fake-dsh"),
    });
    await expect(
      tools[1]!.execute({ experiment: "examples/experiment.yml", output: out }),
    ).resolves.toMatchObject({ version: 1 });
    await expect(
      tools[2]!.execute({ experiment: "examples/experiment.yml", output: out }),
    ).rejects.toThrow('missing required property "policy"');
    await expect(
      tools[2]!.execute({
        experiment: "examples/experiment.yml",
        output: out,
        policy: { min_candidate_pass_rate: 0 },
      }),
    ).resolves.toMatchObject({ verdict: "pass", reasons: [] });
    await expect(profile_lab_gate()).rejects.toThrow("explicit policy");
    dispose();
    expect(tools).toEqual([]);
  }));

describe("packed package", () => {
  it("is accepted as a named row by the official DSH overlay loader", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "profile-lab-dsh-home-"));
    const { stdout } = await execute(
      "pnpm",
      [
        "exec",
        "dsh",
        "--profile",
        "headless",
        "--patch",
        path.resolve("cordis.patch.yml"),
        "--dump-config",
      ],
      { cwd: process.cwd(), env: { ...process.env, DSH_HOME: home } },
    );
    expect(stdout).toContain("id: dsh-profile-lab");
  }, 30_000);

  it("installs the built tarball and executes its linked CLI", async () => {
    const destination = await mkdtemp(path.join(tmpdir(), "profile-lab-pack-"));
    await execute("pnpm", ["build"], { cwd: process.cwd() });
    const { stdout } = await execute(
      "pnpm",
      [
        "--config.ignore-scripts=true",
        "pack",
        "--pack-destination",
        destination,
      ],
      { cwd: process.cwd() },
    );
    expect(stdout).toContain("dsh-profile-lab");
    const tarball = path.join(destination, "dsh-profile-lab-0.1.0.tgz");
    const install = await mkdtemp(path.join(tmpdir(), "profile-lab-install-"));
    await execute("pnpm", ["add", tarball], { cwd: install });
    const result = await execute(
      "pnpm",
      [
        "exec",
        "dsh-profile-lab",
        "schema",
        "--check",
        path.resolve("examples/experiment.yml"),
      ],
      { cwd: install },
    );
    expect(result.stdout).toContain("schema valid");
  }, 30_000);
});
