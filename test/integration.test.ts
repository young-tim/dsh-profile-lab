import { describe, expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  readdir,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { loadExperiment } from "../src/config/index.js";
import { report } from "../src/report/index.js";
import { readRunState, run } from "../src/runner/index.js";
describe("matrix runner", () => {
  it.each([
    ["default inheritance", undefined, true],
    ["env-only isolation", "env-only", false],
  ] as const)(
    "uses %s credentials during execution and never retains them",
    async (_label, credentials, expected) => {
      const sourceHome = await mkdtemp(path.join(tmpdir(), "lab-dsh-home-"));
      const out = await mkdtemp(path.join(tmpdir(), "lab-credentials-out-"));
      const log = path.join(
        await mkdtemp(path.join(tmpdir(), "lab-credentials-log-")),
        "credentials.jsonl",
      );
      const sourceCredentials = path.join(sourceHome, ".credentials.yaml");
      const secret = "token: test-only-secret\n";
      await writeFile(sourceCredentials, secret, { mode: 0o640 });
      await writeFile(log, "");
      const originalHome = process.env.DSH_HOME;
      process.env.DSH_HOME = sourceHome;
      process.env.FAKE_CREDENTIAL_LOG = log;
      try {
        const loaded = await loadExperiment("examples/experiment.yml");
        await run(
          {
            ...loaded,
            repetitions: 1,
            run: {
              ...loaded.run,
              credentials,
              max_runs: 4,
              env_allowlist: ["FAKE_CREDENTIAL_LOG"],
            },
          },
          out,
          path.resolve("fixtures/fake-dsh"),
        );
        const observations = (await readFile(log, "utf8"))
          .trim()
          .split("\n")
          .map(JSON.parse) as Array<{
          exists: boolean;
          content: string | null;
          mode: number | null;
        }>;
        expect(observations).toHaveLength(4);
        expect(observations.every((item) => item.exists === expected)).toBe(
          true,
        );
        if (expected) {
          expect(observations.every((item) => item.content === secret)).toBe(
            true,
          );
          if (process.platform !== "win32")
            expect(observations.every((item) => item.mode === 0o600)).toBe(
              true,
            );
        }
        const cellRoots = await readdir(path.join(out, ".runs"));
        for (const cellRoot of cellRoots)
          await expect(
            stat(
              path.join(
                out,
                ".runs",
                cellRoot,
                "attempt-1",
                "home",
                ".credentials.yaml",
              ),
            ),
          ).rejects.toThrow();
        expect(await readFile(sourceCredentials, "utf8")).toBe(secret);
        for (const artifact of ["manifest.json", "journal.json"])
          expect(
            await readFile(path.join(out, artifact), "utf8"),
          ).not.toContain(secret);
      } finally {
        if (originalHome === undefined) delete process.env.DSH_HOME;
        else process.env.DSH_HOME = originalHome;
        delete process.env.FAKE_CREDENTIAL_LOG;
      }
    },
  );
  it("resumes completed cells without duplicate invocations or source writes", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-out-"));
    const log = path.join(
      await mkdtemp(path.join(tmpdir(), "lab-resume-log-")),
      "calls.jsonl",
    );
    await writeFile(log, "");
    process.env.FAKE_DSH_LOG = log;
    const loaded = await loadExperiment("examples/experiment.yml");
    const e = {
      ...loaded,
      run: { ...loaded.run, env_allowlist: ["FAKE_DSH_LOG"] },
    };
    const before = await readFile("fixtures/repo/README", "utf8");
    try {
      const once = await run(e, out, path.resolve("fixtures/fake-dsh"));
      const twice = await run(e, out, path.resolve("fixtures/fake-dsh"));
      expect(once).toHaveLength(20);
      expect(twice).toHaveLength(20);
      expect(await readFile("fixtures/repo/README", "utf8")).toBe(before);
      expect(new Set(twice.map((x) => x.id)).size).toBe(20);
      expect((await readFile(log, "utf8")).trim().split("\n")).toHaveLength(20);
    } finally {
      delete process.env.FAKE_DSH_LOG;
    }
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
  it("refuses unowned output directories and workspace overlap", async () => {
    const e = await loadExperiment("examples/experiment.yml");
    const unowned = await mkdtemp(path.join(tmpdir(), "lab-unowned-"));
    await writeFile(path.join(unowned, "keep.txt"), "keep");
    await expect(
      run(e, unowned, path.resolve("fixtures/fake-dsh")),
    ).rejects.toThrow("not owned");
    await expect(
      readFile(path.join(unowned, "keep.txt"), "utf8"),
    ).resolves.toBe("keep");
    const overlap = path.resolve("examples/repo/.profile-lab-test");
    await expect(
      run(e, overlap, path.resolve("fixtures/fake-dsh")),
    ).rejects.toThrow("overlaps workspace");
    await expect(stat(overlap)).rejects.toThrow();
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
  it("uses official DSH argv and an isolated workspace cwd for every cell", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-argv-"));
    const log = path.join(
      await mkdtemp(path.join(tmpdir(), "lab-argv-log-")),
      "driver.jsonl",
    );
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
        expect(argv).not.toContain("--workspace");
        expect(argv).not.toContain("--session-root");
        expect(argv).not.toContain("--prompt");
        expect(argv.at(-1)).toMatch(/alpha|beta/i);
      }
    } finally {
      delete process.env.FAKE_DSH_LOG;
    }
  });
  it("times out the slow driver and retains incomplete cell evidence", async () => {
    const sourceHome = await mkdtemp(path.join(tmpdir(), "lab-timeout-home-"));
    await writeFile(
      path.join(sourceHome, ".credentials.yaml"),
      "token: timeout-secret\n",
    );
    const out = await mkdtemp(path.join(tmpdir(), "lab-timeout-"));
    const e = await loadExperiment("examples/experiment.yml");
    const started = Date.now();
    const originalHome = process.env.DSH_HOME;
    process.env.DSH_HOME = sourceHome;
    let result: Awaited<ReturnType<typeof run>>;
    try {
      result = await run(
        {
          ...e,
          repetitions: 1,
          run: { ...e.run, concurrency: 1, max_runs: 4, timeout_ms: 20 },
        },
        out,
        path.resolve("fixtures/fake-slow"),
      );
    } finally {
      if (originalHome === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = originalHome;
    }
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result).toHaveLength(4);
    expect(result.every((cell) => cell.status === "error")).toBe(true);
    expect(result.every((cell) => cell.evidence.startsWith(".runs/"))).toBe(
      true,
    );
    const cellRoots = await readdir(path.join(out, ".runs"));
    for (const cellRoot of cellRoots)
      await expect(
        stat(
          path.join(
            out,
            ".runs",
            cellRoot,
            "attempt-1",
            "home",
            ".credentials.yaml",
          ),
        ),
      ).rejects.toThrow();
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
  it("reads official persisted multi-frame sessions instead of stdout", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-session-"));
    const e = await loadExperiment("examples/experiment.yml");
    const result = await run(
      { ...e, repetitions: 1, run: { ...e.run, max_runs: 4 } },
      out,
      path.resolve("fixtures/fake-dsh-session"),
    );
    expect(result).toHaveLength(4);
    expect(result.every((cell) => cell.turn_reason === "completed")).toBe(true);
    expect(result.every((cell) => cell.input_tokens === 11)).toBe(true);
    expect(result.every((cell) => cell.output_tokens === 7)).toBe(true);
    expect(result.every((cell) => cell.reasoning_tokens === 3)).toBe(true);
    expect(result.every((cell) => cell.cache_read_tokens === 5)).toBe(true);
    expect(result.every((cell) => cell.cache_write_tokens === 2)).toBe(true);
    expect(
      result.every((cell) => cell.evidence.endsWith("session.jsonl.zstd")),
    ).toBe(true);
    expect(result.every((cell) => cell.duration_ms === 9)).toBe(true);
  });
  it("recovers a completed session and records a corrupt trailing frame", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-session-tail-"));
    const e = await loadExperiment("examples/experiment.yml");
    process.env.FAKE_CORRUPT_TAIL = "1";
    try {
      const result = await run(
        {
          ...e,
          repetitions: 1,
          run: {
            ...e.run,
            max_runs: 4,
            env_allowlist: ["FAKE_CORRUPT_TAIL"],
          },
        },
        out,
        path.resolve("fixtures/fake-dsh-session"),
      );
      expect(result.every((cell) => cell.status !== "error")).toBe(true);
      expect(result.every((cell) => cell.corrupt_frames === 1)).toBe(true);
    } finally {
      delete process.env.FAKE_CORRUPT_TAIL;
    }
  });
  it("preflights custom profiles before launching matrix cells", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-profile-"));
    const e = await loadExperiment("examples/experiment.yml");
    await expect(
      run(
        {
          ...e,
          variants: e.variants.map((variant, index) =>
            index ? { ...variant, profile: "missing-profile" } : variant,
          ),
        },
        out,
        path.resolve("fixtures/fake-dsh"),
      ),
    ).rejects.toThrow("profile not found: missing-profile");
    await expect(stat(path.join(out, ".runs"))).rejects.toThrow();
  });
  it("runs an opt-in output judge after structural assertions", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-judge-"));
    const experimentFile = "fixtures/judge-experiment.yml";
    const e = await loadExperiment(experimentFile);
    const result = await run(
      e,
      out,
      path.resolve("fixtures/fake-dsh"),
      experimentFile,
    );
    expect(result.map((cell) => cell.status).sort()).toEqual(["fail", "pass"]);
    expect(
      result.every((cell) => cell.judge?.evidence.endsWith("judge.json")),
    ).toBe(true);
    expect(result.every((cell) => cell.judge?.input_tokens === 4)).toBe(true);
    expect(
      result.every((cell) => cell.attempt_details?.[0]?.input_tokens === 24),
    ).toBe(true);
    const generated = await report(out, e, result);
    const schema = JSON.parse(
      await readFile("schemas/report.schema.json", "utf8"),
    );
    expect(new Ajv2020({ strict: true }).validate(schema, generated)).toBe(
      true,
    );
  });
  it.each([
    ["exit", "output judge exited 9"],
    ["invalid-json", "invalid JSON"],
    ["missing-pass", "requires pass boolean"],
    ["invalid-usage", "invalid usage"],
    ["timeout", "timed out"],
  ])("retains output-judge adapter failure: %s", async (mode, message) => {
    const out = await mkdtemp(path.join(tmpdir(), `lab-judge-${mode}-`));
    const experimentFile = "fixtures/judge-experiment.yml";
    const loaded = await loadExperiment(experimentFile);
    process.env.FAKE_JUDGE_MODE = mode;
    try {
      const result = await run(
        {
          ...loaded,
          repetitions: 1,
          run: { ...loaded.run, max_runs: 2 },
          judge: {
            ...loaded.judge!,
            timeout_ms: mode === "timeout" ? 20 : loaded.judge!.timeout_ms,
            env_allowlist: ["FAKE_JUDGE_MODE"],
          },
        },
        out,
        path.resolve("fixtures/fake-dsh"),
        experimentFile,
      );
      expect(result).toHaveLength(2);
      expect(result.every((cell) => cell.status === "error")).toBe(true);
      expect(
        result.every((cell) => cell.assertion_failures?.[0]?.includes(message)),
      ).toBe(true);
      if (mode === "exit")
        expect(JSON.stringify(result)).not.toContain("secret-value");
    } finally {
      delete process.env.FAKE_JUDGE_MODE;
    }
  });
  it("retains every failed retry attempt before the first pass", async () => {
    const out = await mkdtemp(path.join(tmpdir(), "lab-retry-"));
    const experimentFile = "fixtures/retry-experiment.yml";
    const e = await loadExperiment(experimentFile);
    const result = await run(
      e,
      out,
      path.resolve("fixtures/fake-retry"),
      experimentFile,
    );
    expect(result).toHaveLength(2);
    expect(
      result.every((cell) => cell.status === "pass" && cell.attempts === 2),
    ).toBe(true);
    expect(
      result.every(
        (cell) =>
          JSON.stringify(
            cell.attempt_details?.map((attempt) => attempt.status),
          ) === JSON.stringify(["fail", "pass"]),
      ),
    ).toBe(true);
    expect(
      result.every(
        (cell) =>
          new Set(cell.attempt_details?.map((attempt) => attempt.evidence))
            .size === 2,
      ),
    ).toBe(true);
  });
});
