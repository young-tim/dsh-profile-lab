import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
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
});
