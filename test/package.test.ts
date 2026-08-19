import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "@deepseek-ai/dsh-tools";
import { apply, profile_lab_gate } from "../src/plugin/index.js";
import {
  apply as packageApply,
  inject as packageInject,
  name as packageName,
} from "../src/index.js";
const execute = promisify(execFile);
describe("package surface", () =>
  it("ships one bundle row and three executable tools", async () => {
    const patch = await readFile("cordis.patch.yml", "utf8");
    expect(patch).toContain("dsh-profile-lab");
    expect(patch).toContain("dsh-profile-lab-skills");
    expect(patch).toContain("customSkillDirs");
    await expect(
      readFile("skills/profile-lab-author-cases/SKILL.md", "utf8"),
    ).resolves.toContain("Ask for explicit approval");
    expect(packageName).toBe("dsh-profile-lab");
    expect(packageInject).toEqual(["tools"]);
    expect(packageApply).toBe(apply);
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
    await expect(
      tools[0]!.execute({
        experiment: "examples/experiment.yml",
        output: out,
        driver: path.resolve("fixtures/fake-dsh"),
      }),
    ).resolves.toMatchObject({ version: 1, incomplete: false });
    await expect(
      readFile(path.join(out, "report.json"), "utf8"),
    ).resolves.toContain('"version": 1');
    await expect(tools[1]!.execute({ output: out })).resolves.toMatchObject({
      version: 1,
    });
    const compare = await tools[1]!.execute({ output: out });
    expect(JSON.stringify(compare)).not.toContain("undefined");
    const lossless = (value: unknown): boolean => {
      if (value === undefined) return false;
      if (typeof value === "number") return Number.isFinite(value);
      if (Array.isArray(value)) return value.every(lossless);
      if (value && typeof value === "object")
        return Object.values(value).every(lossless);
      return typeof value !== "bigint";
    };
    expect(lossless(compare)).toBe(true);
    await expect(
      tools[2]!.execute({ experiment: "examples/experiment.yml", output: out }),
    ).rejects.toThrow('missing required property "policy"');
    await expect(
      tools[2]!.execute({
        output: out,
        policy: { min_candidate_pass_rate: 0 },
      }),
    ).resolves.toMatchObject({ verdict: "pass", reasons: [] });
    await expect(profile_lab_gate()).rejects.toThrow("explicit policy");
    dispose();
    expect(tools).toEqual([]);
  }));

describe("web client surface", () => {
  it("declares and builds the native conversation analysis tab", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8")) as {
      dsh: { client: { platform: string; inject: string[] } };
      exports: Record<string, string>;
    };
    expect(pkg.dsh.client).toEqual({
      inject: ["@deepseek-ai/dsh-client-ui-conversation"],
      platform: "web",
    });
    expect(pkg.exports["./client"]).toBe("./dist/client.js");
    await execute("pnpm", ["build"], { cwd: process.cwd() });
    const client = await readFile("dist/client.js", "utf8");
    expect(client).toContain("window.__ModuleLoader__.load");
    expect(client).toContain("profile-lab-analysis");
    expect(client).toContain("Profile \\u7EC4\\u5408\\u5BF9\\u6BD4");
    expect(client).toContain("\\u5982\\u4F55\\u8FD0\\u884C\\u8BC4\\u6D4B");
  });
});

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
    const output = path.join(install, "result");
    const cli = (args: string[]) =>
      execute("pnpm", ["exec", "dsh-profile-lab", ...args], { cwd: install });
    await cli([
      "run",
      path.resolve("examples/experiment.yml"),
      "--driver",
      path.resolve("fixtures/fake-dsh"),
      "--output",
      output,
    ]);
    await cli(["compare", output]);
    await expect(
      readFile(path.join(output, "report.json"), "utf8"),
    ).resolves.toContain('"input_hash"');
    await expect(
      cli(["gate", output, "--policy", path.resolve("examples/policy.yml")]),
    ).rejects.toMatchObject({ code: 1 });
    const dshHome = await mkdtemp(
      path.join(tmpdir(), "profile-lab-installed-home-"),
    );
    const installedPatch = path.join(
      install,
      "node_modules/dsh-profile-lab/cordis.patch.yml",
    );
    const loaded = await execute(
      path.resolve("node_modules/.bin/dsh"),
      ["--profile", "headless", "--patch", installedPatch, "--dump-config"],
      { cwd: install, env: { ...process.env, DSH_HOME: dshHome } },
    );
    expect(loaded.stdout).toContain("id: dsh-profile-lab");
  }, 30_000);
});
