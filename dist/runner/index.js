import { cp, lstat, mkdir, readdir, readFile, rename, rm, writeFile, } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { loadCases, resolveInput } from "../config/index.js";
import { evaluateCase } from "../assertions/index.js";
import { parseJsonl, projectCell } from "../dsh-adapter/index.js";
const atomic = async (file, value) => {
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
    await rename(temp, file);
};
const sha = (value) => createHash("sha256").update(value).digest("hex");
const safeTree = async (root) => {
    const st = await lstat(root);
    if (st.isSymbolicLink() || (!st.isDirectory() && !st.isFile()))
        throw new Error(`E_SAFETY: unsafe workspace entry: ${root}`);
    if (st.isDirectory())
        for (const name of await readdir(root))
            await safeTree(path.join(root, name));
};
export const cells = (e, cases = [{ name: "default", prompt: "" }]) => e.variants.flatMap((v) => cases.flatMap((c) => Array.from({ length: e.repetitions }, (_, i) => ({
    id: sha(`${v.id}\0${c.name}\0${i + 1}`).slice(0, 16),
    variant: v.id,
    case: c.name,
    repetition: i + 1,
    source: c,
}))));
const invoke = (driver, args, env, timeout) => new Promise((resolve, reject) => {
    const child = spawn(driver, args, {
        shell: false,
        detached: process.platform !== "win32",
        env,
    });
    let text = "";
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid)
            process.kill(-child.pid, "SIGTERM");
    }, timeout);
    child.stdout.on("data", (data) => {
        text += data;
    });
    child.on("error", reject);
    child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut)
            resolve({ text, timedOut });
        else if (code === 0)
            resolve({ text, timedOut });
        else
            reject(new Error(`E_RUN: driver exit ${code}`));
    });
});
export const run = async (e, base, driver, experimentFile = "examples/experiment.yml", filters, restart = false) => {
    if (path.isAbsolute(base) && !base)
        throw new Error("E_SAFETY: invalid output");
    await mkdir(base, { recursive: true });
    const journal = path.join(base, "journal.json");
    if (restart)
        await rm(journal, { force: true });
    const casesLoaded = await loadCases(experimentFile, e, filters);
    const plan = cells(e, casesLoaded);
    if (plan.length > e.run.max_runs)
        throw new Error("E_CONFIG: max_runs exceeded");
    let template = resolveInput(experimentFile, e.workspace_template);
    try {
        await safeTree(template);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
        template = path.resolve(path.dirname(experimentFile), "repo");
        await safeTree(template);
    }
    for (const variant of e.variants) {
        await readFile(resolveInput(experimentFile, variant.patch));
    }
    let done = [];
    try {
        done = JSON.parse(await readFile(journal, "utf8"));
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw new Error("E_RUN: invalid journal");
    }
    const todo = plan.filter((p) => !done.some((c) => c.id === p.id && ["pass", "fail"].includes(c.status)));
    let next = 0;
    let totalTokens = done.reduce((n, c) => n + c.input_tokens + c.output_tokens + c.reasoning_tokens, 0);
    let writes = Promise.resolve();
    const worker = async () => {
        while (next < todo.length) {
            const item = todo[next++];
            if (totalTokens >= e.run.max_total_tokens)
                return;
            const variant = e.variants.find((v) => v.id === item.variant);
            const root = path.join(base, ".runs", item.id);
            const workspace = path.join(root, "workspace");
            await mkdir(root, { recursive: true });
            await cp(template, workspace, { recursive: true, dereference: false });
            let result;
            const attempts = (item.source.retries ?? 0) + 1;
            for (let attempt = 1; attempt <= attempts; attempt++) {
                const args = [
                    "--profile",
                    variant.profile,
                    "--patch",
                    resolveInput(experimentFile, variant.patch),
                    "--workspace",
                    workspace,
                    "--session-root",
                    path.join(root, "session"),
                    "--prompt",
                    item.source.prompt,
                    "--variant",
                    variant.id,
                ];
                const env = {
                    PATH: process.env.PATH ?? "",
                    DSH_HOME: path.join(root, "home"),
                };
                for (const name of e.run.env_allowlist ?? [])
                    if (process.env[name] !== undefined)
                        env[name] = process.env[name];
                const started = Date.now();
                try {
                    const output = await invoke(driver, args, env, e.run.timeout_ms);
                    const events = parseJsonl(output.text);
                    result = projectCell(item, events, path.relative(base, root));
                    result.duration_ms ||= Date.now() - started;
                    result.attempts = attempt;
                    if (output.timedOut)
                        result.status = "error";
                    const verdict = evaluateCase(item.source, events);
                    if (!verdict.ok && result.status === "pass") {
                        result.status = "fail";
                        result.assertion_failures = verdict.failures.map((x) => x.code);
                    }
                    if (result.status === "pass")
                        break;
                }
                catch (error) {
                    result = {
                        ...projectCell(item, [], path.relative(base, root)),
                        status: "error",
                        attempts: attempt,
                        assertion_failures: [error.message],
                    };
                }
            }
            if (result) {
                done = [...done.filter((c) => c.id !== result.id), result];
                totalTokens +=
                    result.input_tokens + result.output_tokens + result.reasoning_tokens;
                const snapshot = [...done].sort((a, b) => a.id.localeCompare(b.id));
                writes = writes.then(() => atomic(journal, snapshot));
                await writes;
            }
        }
    };
    await Promise.all(Array.from({ length: e.run.concurrency }, worker));
    await writes;
    if (done.length && done.every((c) => c.turn_reason === "missing"))
        throw new Error("E_RUN: driver produced no turn/end event");
    return done.sort((a, b) => a.id.localeCompare(b.id));
};
