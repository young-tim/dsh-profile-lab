import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadExperiment } from "../src/config/index.js";
import { readRunState, run } from "../src/runner/index.js";
describe("matrix runner", () => {
  it("resumes completed cells without duplicate invocations or source writes", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-out-"));
    const e = await loadExperiment("examples/experiment.yml");
    const before = await readFile("fixtures/repo/README", "utf8");
    const once = await run(e, out, path.resolve("fixtures/fake-dsh"));
    const twice = await run(e, out, path.resolve("fixtures/fake-dsh"));
    expect(once).toHaveLength(20);
    expect(twice).toHaveLength(20);
    expect(await readFile("fixtures/repo/README", "utf8")).toBe(before);
    expect(new Set(twice.map((x) => x.id)).size).toBe(20);
  });
  it("rejects driver output with no durable end event", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-out-"));
    const e = await loadExperiment("examples/experiment.yml");
    await expect(
      run(e, out, path.resolve("fixtures/fake-noevents")),
    ).rejects.toThrow("no turn/end");
  });
  it("rejects source symlinks before driver launch", async () => {
    const source = await mkdtemp(path.join(tmpdir(), "lab-source-"));
    await symlink("/tmp", path.join(source, "escape"));
    const out = await mkdtemp(path.join(tmpdir(), "lab-out-"));
    const e = await loadExperiment("examples/experiment.yml");
    e.workspace_template = source;
    await expect(
      run(e, out, path.resolve("fixtures/fake-dsh")),
    ).rejects.toThrow("unsafe workspace entry");
  });
  it("rejects resume after an experiment input change", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-resume-"));
    const e = await loadExperiment("examples/experiment.yml");
    await run(e, out, path.resolve("fixtures/fake-dsh"));
    await expect(
      run(
        { ...e, name: "changed-input" },
        out,
        path.resolve("fixtures/fake-dsh"),
      ),
    ).rejects.toThrow("resume input hash mismatch");
  });
  it("stops dispatching on budget and records an incomplete run", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-budget-"));
    const e = await loadExperiment("examples/experiment.yml");
    const cells = await run(
      { ...e, run: { ...e.run, concurrency: 1, max_total_tokens: 0 } },
      out,
      path.resolve("fixtures/fake-dsh"),
    );
    expect(cells).toEqual([]);
    await expect(readRunState(out)).resolves.toMatchObject({
      incomplete: true,
      reason: "budget",
    });
  });
  it("passes profile, patch, workspace, session and prompt argv to every cell", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-argv-"));
    const log = path.join(out, "driver.jsonl");
    await writeFile(log, "");
    process.env.FAKE_DSH_LOG = log;
    try {
      const e = await loadExperiment("examples/experiment.yml");
      await run(
        { ...e, run: { ...e.run, env_allowlist: ["FAKE_DSH_LOG"] } },
        out,
        path.resolve("fixtures/fake-dsh"),
      );
      const calls = (await readFile(log, "utf8"))
        .trim()
        .split("\n")
        .map(JSON.parse) as string[][];
      expect(calls).toHaveLength(20);
      for (const argv of calls) {
        expect(argv).toContain("--profile");
        expect(argv).toContain("headless");
        expect(argv).toContain("--patch");
        expect(argv).toContain("--workspace");
        expect(argv).toContain("--session-root");
        expect(argv).toContain("--prompt");
      }
    } finally {
      delete process.env.FAKE_DSH_LOG;
    }
  });
  it("times out the slow driver and retains incomplete cell evidence", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-timeout-"));
    const e = await loadExperiment("examples/experiment.yml");
    const started = Date.now();
    const result = await run(
      {
        ...e,
        repetitions: 1,
        run: { ...e.run, concurrency: 1, max_runs: 4, timeout_ms: 20 },
      },
      out,
      path.resolve("fixtures/fake-slow"),
    );
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result).toHaveLength(4);
    expect(result.every((cell) => cell.status === "error")).toBe(true);
    expect(result.every((cell) => cell.evidence.startsWith(".runs/"))).toBe(
      true,
    );
  });
  it("stops dispatching when the runner cancellation signal aborts", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-cancel-"));
    const e = await loadExperiment("examples/experiment.yml");
    const controller = new AbortController();
    controller.abort();
    const result = await run(
      e,
      out,
      path.resolve("fixtures/fake-dsh"),
      "examples/experiment.yml",
      undefined,
      false,
      controller.signal,
    );
    expect(result).toEqual([]);
    await expect(readRunState(out)).resolves.toMatchObject({
      incomplete: true,
      reason: "cancelled",
    });
  });
  it("maps a real CLI SIGINT to exit code 3 and cancelled state", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-cli-sigint-"));
    const child = spawn(
      process.execPath,
      [
        "dist/cli.js",
        "run",
        "examples/experiment.yml",
        "--driver",
        path.resolve("fixtures/fake-slow"),
        "--output",
        out,
        "--restart",
      ],
      { cwd: process.cwd(), stdio: "ignore" },
    );
    let started = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        await stat(path.join(out, ".runs"));
        started = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    expect(started).toBe(true);
    child.kill("SIGINT");
    const code = await new Promise<number | null>((resolve) =>
      child.once("close", resolve),
    );
    expect(code).toBe(3);
    await expect(readRunState(out)).resolves.toMatchObject({
      incomplete: true,
      reason: "cancelled",
    });
  }, 10_000);
});
