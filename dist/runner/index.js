import { access, cp, lstat, mkdir, readdir, readFile, rename, rm, writeFile, } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { loadCases, resolveInput } from "../config/index.js";
import { evaluateCaseWithJudge } from "../assertions/index.js";
import { parseJsonl, projectCell, readSessionDetailed, } from "../dsh-adapter/index.js";
import { redact, sanitize } from "../security/index.js";
const atomic = async (file, value) => {
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
    await rename(temp, file);
};
const sha = (value) => createHash("sha256").update(value).digest("hex");
const terminate = (child) => {
    if (!child.pid)
        return;
    try {
        process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM");
    }
    catch (error) {
        if (error.code !== "ESRCH")
            throw error;
    }
};
const forceTerminate = (child) => {
    if (!child.pid)
        return;
    try {
        process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL");
    }
    catch (error) {
        if (error.code !== "ESRCH")
            throw error;
    }
};
const safeTree = async (root) => {
    const st = await lstat(root);
    if (st.isSymbolicLink() || (!st.isDirectory() && !st.isFile()))
        throw new Error(`E_SAFETY: unsafe workspace entry: ${root}`);
    if (st.isDirectory())
        for (const name of await readdir(root))
            await safeTree(path.join(root, name));
};
const treeHash = async (root) => {
    const parts = [];
    const visit = async (current, relative = "") => {
        const stat = await lstat(current);
        if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
            throw new Error(`E_SAFETY: unsafe workspace entry: ${current}`);
        if (stat.isFile()) {
            parts.push(`${relative}\0${sha(await readFile(current))}`);
            return;
        }
        for (const name of (await readdir(current)).sort())
            await visit(path.join(current, name), path.join(relative, name));
    };
    await visit(root);
    return sha(parts.join("\n"));
};
const sessionFiles = async (root) => {
    const found = [];
    const visit = async (current) => {
        let entries;
        try {
            entries = await readdir(current, { withFileTypes: true });
        }
        catch (error) {
            if (error.code === "ENOENT")
                return;
            throw error;
        }
        for (const entry of entries) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory())
                await visit(target);
            else if (/session\.jsonl(?:\.zstd)?$/.test(entry.name))
                found.push(target);
        }
    };
    await visit(root);
    return found.sort();
};
const copyProfile = async (profile, home) => {
    const sourceHome = process.env.DSH_HOME ?? path.join(homedir(), ".dsh");
    const source = path.join(sourceHome, "profiles", profile);
    try {
        await access(source);
        await mkdir(path.join(home, "profiles"), { recursive: true });
        await cp(source, path.join(home, "profiles", profile), {
            recursive: true,
            dereference: false,
        });
    }
    catch (error) {
        if (error.code === "ENOENT" &&
            ["headless", "web"].includes(profile))
            return;
        throw new Error(`E_CONFIG: profile not found: ${profile}`);
    }
};
const preflightProfiles = async (profiles) => {
    const sourceHome = process.env.DSH_HOME ?? path.join(homedir(), ".dsh");
    for (const profile of [...new Set(profiles)]) {
        if (["headless", "web"].includes(profile))
            continue;
        try {
            await access(path.join(sourceHome, "profiles", profile));
        }
        catch {
            throw new Error(`E_CONFIG: profile not found: ${profile}`);
        }
    }
};
const executable = async (driver) => {
    const candidates = driver.includes("/") || driver.includes("\\")
        ? [path.resolve(driver)]
        : (process.env.PATH ?? "")
            .split(path.delimiter)
            .filter(Boolean)
            .flatMap((directory) => process.platform === "win32"
            ? [".exe", ".cmd", ".bat", ""].map((ext) => path.join(directory, `${driver}${ext}`))
            : [path.join(directory, driver)]);
    for (const candidate of candidates)
        try {
            await access(candidate, constants.X_OK);
            return candidate;
        }
        catch {
            // Continue through PATH candidates.
        }
    throw new Error(`E_CONFIG: driver is not executable: ${driver}`);
};
export const readRunState = async (base) => {
    try {
        return JSON.parse(await readFile(path.join(base, "run-state.json"), "utf8"));
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { version: 1, incomplete: false };
        throw new Error("E_RUN: invalid run state");
    }
};
export const cells = (e, cases = [{ name: "default", prompt: "" }], variantHashes = {}) => e.variants.flatMap((v) => cases.flatMap((c) => Array.from({ length: e.repetitions }, (_, i) => ({
    id: sha(JSON.stringify({
        variant: v,
        variant_hash: variantHashes[v.id] ?? sha(JSON.stringify(v)),
        case: c,
        repetition: i + 1,
    })).slice(0, 16),
    variant: v.id,
    case: c.name,
    repetition: i + 1,
    source: c,
}))));
const invoke = (driver, args, env, timeout, cwd, signal, input) => new Promise((resolve, reject) => {
    const child = spawn(driver, args, {
        shell: false,
        detached: process.platform !== "win32",
        env,
        cwd,
    });
    let text = "";
    let stderr = "";
    let timedOut = false;
    let aborted = false;
    let forceTimer;
    const stop = () => {
        terminate(child);
        forceTimer = setTimeout(() => forceTerminate(child), 2_000);
    };
    const timer = setTimeout(() => {
        timedOut = true;
        stop();
    }, timeout);
    const abort = () => {
        aborted = true;
        stop();
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (data) => {
        text += data;
    });
    child.stderr.on("data", (data) => {
        stderr += data;
    });
    child.stdin.on("error", (error) => {
        if (error.code !== "EPIPE")
            reject(error);
    });
    child.stdin.end(input);
    child.on("error", reject);
    child.on("close", (code) => {
        clearTimeout(timer);
        if (forceTimer)
            clearTimeout(forceTimer);
        signal?.removeEventListener("abort", abort);
        resolve({ text, stderr, timedOut, aborted, code });
    });
});
export const run = async (e, base, driver, experimentFile = "examples/experiment.yml", filters, restart = false, signal) => {
    if (!base.trim())
        throw new Error("E_SAFETY: invalid output");
    base = path.resolve(base);
    const driverExecutable = await executable(driver);
    const template = resolveInput(experimentFile, e.workspace_template);
    const relativeOutput = path.relative(template, base);
    if (relativeOutput === "" ||
        (!relativeOutput.startsWith(`..${path.sep}`) && relativeOutput !== ".."))
        throw new Error("E_SAFETY: output directory overlaps workspace template");
    await mkdir(base, { recursive: true });
    const ownerFile = path.join(base, ".profile-lab-owner.json");
    let owned = false;
    try {
        const owner = JSON.parse(await readFile(ownerFile, "utf8"));
        owned = owner.product === "dsh-profile-lab";
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw new Error("E_SAFETY: invalid output ownership marker");
    }
    const existing = (await readdir(base)).filter((name) => name !== ".DS_Store" && name !== ".profile-lab-owner.json");
    if (existing.length && !owned)
        throw new Error("E_SAFETY: output directory is not owned by Profile Lab");
    await atomic(ownerFile, { version: 1, product: "dsh-profile-lab" });
    const journal = path.join(base, "journal.json");
    const stateFile = path.join(base, "run-state.json");
    const manifestFile = path.join(base, "manifest.json");
    if (restart) {
        for (const owned of [
            "journal.json",
            "run-state.json",
            "manifest.json",
            "report.json",
            "report.md",
            "report.html",
            ".runs",
        ])
            await rm(path.join(base, owned), { recursive: true, force: true });
    }
    const casesLoaded = await loadCases(experimentFile, e, filters);
    const needsJudge = casesLoaded.some((caseItem) => (caseItem.assert ?? caseItem.assertions ?? {}).output_judge !== undefined);
    if (needsJudge && !e.judge)
        throw new Error("E_CONFIG: output_judge requires experiment.judge");
    const judgeExecutable = e.judge
        ? await executable(resolveInput(experimentFile, e.judge.command))
        : undefined;
    const judgeHash = judgeExecutable
        ? sha(await readFile(judgeExecutable))
        : undefined;
    await preflightProfiles(e.variants.map((variant) => variant.profile));
    await safeTree(template);
    const workspaceHash = await treeHash(template);
    for (const variant of e.variants) {
        await readFile(resolveInput(experimentFile, variant.patch));
    }
    const patchContents = await Promise.all(e.variants.map((variant) => readFile(resolveInput(experimentFile, variant.patch), "utf8")));
    for (const [index, content] of patchContents.entries()) {
        const doc = YAML.parseDocument(content, {
            uniqueKeys: true,
            merge: false,
            prettyErrors: false,
        });
        if (doc.errors.length || doc.warnings.length)
            throw new Error(`E_CONFIG: invalid patch for ${e.variants[index].id}`);
        let value;
        try {
            value = doc.toJS({ maxAliasCount: 0 });
        }
        catch (error) {
            throw new Error(`E_CONFIG: invalid patch for ${e.variants[index].id}: ${error.message}`);
        }
        if (!Array.isArray(value))
            throw new Error(`E_CONFIG: patch for ${e.variants[index].id} must be a top-level array`);
    }
    const patchHashes = Object.fromEntries(e.variants.map((variant, index) => [
        variant.id,
        sha(patchContents[index]),
    ]));
    const plan = cells(e, casesLoaded, patchHashes);
    if (plan.length > e.run.max_runs)
        throw new Error("E_CONFIG: max_runs exceeded");
    const inputHash = sha(JSON.stringify({
        runner: 2,
        experiment: e,
        cases: casesLoaded,
        patches: patchContents.map(sha),
        workspace: workspaceHash,
        judge: judgeHash,
    }));
    try {
        const previous = JSON.parse(await readFile(manifestFile, "utf8"));
        if (previous.input_hash !== inputHash && !restart)
            throw new Error("E_CONFIG: resume input hash mismatch; use --restart");
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    await atomic(manifestFile, {
        version: 2,
        input_hash: inputHash,
        experiment_file: path.resolve(experimentFile),
        experiment: e,
        workspace_hash: workspaceHash,
        ...(judgeHash ? { judge_hash: judgeHash } : {}),
        case_hashes: Object.fromEntries(casesLoaded.map((caseItem) => [
            caseItem.name,
            sha(JSON.stringify(caseItem)),
        ])),
        patch_hashes: patchHashes,
    });
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
    let budgetStopped = false;
    let incompleteReason;
    const worker = async () => {
        while (next < todo.length) {
            if (signal?.aborted) {
                budgetStopped = true;
                incompleteReason = "cancelled";
                return;
            }
            const item = todo[next++];
            if (totalTokens >= e.run.max_total_tokens) {
                budgetStopped = true;
                incompleteReason = "budget";
                return;
            }
            const variant = e.variants.find((v) => v.id === item.variant);
            const root = path.join(base, ".runs", item.id);
            await mkdir(root, { recursive: true });
            let result;
            const attemptDetails = [];
            const attempts = (item.source.retries ?? 0) + 1;
            for (let attempt = 1; attempt <= attempts; attempt++) {
                const attemptRoot = path.join(root, `attempt-${attempt}`);
                const workspace = path.join(attemptRoot, "workspace");
                const home = path.join(attemptRoot, "home");
                await rm(attemptRoot, { recursive: true, force: true });
                await mkdir(attemptRoot, { recursive: true });
                await cp(template, workspace, { recursive: true, dereference: false });
                await copyProfile(variant.profile, home);
                const variantIndex = e.variants.indexOf(variant);
                const patchCopy = path.join(attemptRoot, `${variant.id}-${path.basename(variant.patch)}`);
                await writeFile(patchCopy, patchContents[variantIndex]);
                const args = [
                    "--profile",
                    variant.profile,
                    "--patch",
                    patchCopy,
                    item.source.prompt,
                ];
                const env = {
                    PATH: process.env.PATH ?? "",
                    HOME: process.env.HOME ?? homedir(),
                    DSH_HOME: home,
                };
                for (const name of e.run.env_allowlist ?? [])
                    if (process.env[name] !== undefined)
                        env[name] = process.env[name];
                const started = Date.now();
                try {
                    const output = await invoke(driverExecutable, args, env, e.run.timeout_ms, workspace, signal);
                    let events = parseJsonl(output.text);
                    let corruptFrames = 0;
                    let corruptRecords = 0;
                    let evidence = path.relative(base, attemptRoot);
                    if (!events.some((event) => event.type === "turn/end")) {
                        const files = await sessionFiles(path.join(home, "sessions"));
                        if (files.length) {
                            const session = files.at(-1);
                            const read = await readSessionDetailed(session);
                            events = read.events;
                            corruptFrames = read.corrupt_frames;
                            corruptRecords = read.corrupt_records;
                            evidence = path.relative(base, session);
                        }
                    }
                    result = projectCell(item, events, evidence);
                    if (corruptFrames)
                        result.corrupt_frames = corruptFrames;
                    if (corruptRecords)
                        result.corrupt_records = corruptRecords;
                    result.duration_ms ||= Date.now() - started;
                    result.attempts = attempt;
                    if (output.timedOut) {
                        result.status = "error";
                        result.turn_reason = "timeout";
                    }
                    else if (output.aborted) {
                        result.status = "cancelled";
                        result.turn_reason = "cancelled";
                    }
                    else if (output.code !== 0 && result.status === "pass") {
                        result.status = "error";
                        result.turn_reason = `driver-exit-${output.code}`;
                    }
                    let judgeEvidence;
                    const verdict = await evaluateCaseWithJudge(item.source, events, judgeExecutable && e.judge
                        ? async (judgeInput) => {
                            const judgeEnv = {
                                PATH: process.env.PATH ?? "",
                                HOME: process.env.HOME ?? homedir(),
                            };
                            for (const name of e.judge.env_allowlist ?? [])
                                if (process.env[name] !== undefined)
                                    judgeEnv[name] = process.env[name];
                            const judged = await invoke(judgeExecutable, [], judgeEnv, e.judge.timeout_ms, workspace, signal, JSON.stringify(judgeInput));
                            if (judged.timedOut)
                                throw new Error("E_RUN: output judge timed out");
                            if (judged.code !== 0)
                                throw new Error(`E_RUN: output judge exited ${judged.code}: ${redact(judged.stderr)}`);
                            const lines = judged.text
                                .trim()
                                .split(/\r?\n/)
                                .filter(Boolean);
                            let parsed;
                            try {
                                parsed = JSON.parse(lines.at(-1) ?? "");
                            }
                            catch {
                                throw new Error("E_RUN: output judge returned invalid JSON");
                            }
                            if (typeof parsed.pass !== "boolean")
                                throw new Error("E_RUN: output judge result requires pass boolean");
                            const usage = parsed.usage && typeof parsed.usage === "object"
                                ? parsed.usage
                                : {};
                            const judgeFile = path.join(attemptRoot, "judge.json");
                            judgeEvidence = {
                                pass: parsed.pass,
                                ...(typeof parsed.reason === "string"
                                    ? { reason: redact(parsed.reason) }
                                    : {}),
                                input_tokens: Number(usage.input_tokens ?? usage.inputTokens ?? 0),
                                output_tokens: Number(usage.output_tokens ?? usage.outputTokens ?? 0),
                                reasoning_tokens: Number(usage.reasoning_tokens ?? usage.reasoningTokens ?? 0),
                                evidence: path.relative(base, judgeFile),
                            };
                            if (![
                                judgeEvidence.input_tokens,
                                judgeEvidence.output_tokens,
                                judgeEvidence.reasoning_tokens,
                            ].every((value) => Number.isFinite(value) && value >= 0))
                                throw new Error("E_RUN: output judge returned invalid usage");
                            await atomic(judgeFile, sanitize({ input: judgeInput, result: judgeEvidence }));
                            return parsed.pass;
                        }
                        : undefined);
                    if (judgeEvidence)
                        result.judge = judgeEvidence;
                    if (!verdict.ok && result.status === "pass") {
                        result.status = "fail";
                        result.assertion_failures = verdict.failures.map((x) => x.code);
                    }
                    attemptDetails.push({
                        attempt,
                        status: result.status,
                        duration_ms: result.duration_ms,
                        evidence,
                        turn_reason: result.turn_reason,
                        ...(output.stderr.trim()
                            ? { diagnostic: redact(output.stderr.trim().slice(0, 2_000)) }
                            : {}),
                        input_tokens: result.input_tokens + (result.judge?.input_tokens ?? 0),
                        output_tokens: result.output_tokens + (result.judge?.output_tokens ?? 0),
                        reasoning_tokens: result.reasoning_tokens + (result.judge?.reasoning_tokens ?? 0),
                    });
                    result.attempt_details = [...attemptDetails];
                    totalTokens +=
                        attemptDetails.at(-1).input_tokens +
                            attemptDetails.at(-1).output_tokens +
                            attemptDetails.at(-1).reasoning_tokens;
                    if (totalTokens >= e.run.max_total_tokens) {
                        budgetStopped = true;
                        incompleteReason = "budget";
                    }
                    if (result.status === "pass")
                        break;
                    if (budgetStopped)
                        break;
                }
                catch (error) {
                    result = result
                        ? {
                            ...result,
                            status: "error",
                            attempts: attempt,
                            turn_reason: "attempt-error",
                            assertion_failures: [redact(error.message)],
                        }
                        : {
                            ...projectCell(item, [], path.relative(base, attemptRoot)),
                            status: "error",
                            attempts: attempt,
                            assertion_failures: [redact(error.message)],
                        };
                    attemptDetails.push({
                        attempt,
                        status: "error",
                        duration_ms: Date.now() - started,
                        evidence: path.relative(base, attemptRoot),
                        diagnostic: redact(error.message),
                        input_tokens: result.input_tokens + (result.judge?.input_tokens ?? 0),
                        output_tokens: result.output_tokens + (result.judge?.output_tokens ?? 0),
                        reasoning_tokens: result.reasoning_tokens + (result.judge?.reasoning_tokens ?? 0),
                    });
                    result.attempt_details = [...attemptDetails];
                    const failedAttempt = attemptDetails.at(-1);
                    totalTokens +=
                        (failedAttempt.input_tokens ?? 0) +
                            (failedAttempt.output_tokens ?? 0) +
                            (failedAttempt.reasoning_tokens ?? 0);
                    if (totalTokens >= e.run.max_total_tokens) {
                        budgetStopped = true;
                        incompleteReason = "budget";
                        break;
                    }
                }
            }
            if (result) {
                done = [...done.filter((c) => c.id !== result.id), result];
                const snapshot = [...done].sort((a, b) => a.id.localeCompare(b.id));
                writes = writes.then(() => atomic(journal, sanitize(snapshot)));
                await writes;
            }
        }
    };
    await Promise.all(Array.from({ length: e.run.concurrency }, worker));
    await writes;
    if ((await treeHash(template)) !== workspaceHash)
        throw new Error("E_SAFETY: source workspace changed during run");
    const currentPatchHashes = await Promise.all(e.variants.map((variant) => readFile(resolveInput(experimentFile, variant.patch), "utf8").then(sha)));
    if (currentPatchHashes.some((hash, index) => hash !== sha(patchContents[index])))
        throw new Error("E_SAFETY: source patch changed during run");
    if (judgeExecutable &&
        judgeHash !== undefined &&
        sha(await readFile(judgeExecutable)) !== judgeHash)
        throw new Error("E_SAFETY: judge command changed during run");
    const hasErrors = done.some((cell) => cell.status === "error" || cell.status === "cancelled");
    const unfinished = done.length < plan.length;
    const finalReason = signal?.aborted
        ? "cancelled"
        : unfinished
            ? incompleteReason
            : undefined;
    await atomic(stateFile, {
        version: 1,
        incomplete: unfinished || hasErrors,
        ...(finalReason ? { reason: finalReason } : {}),
    });
    if (done.length && done.every((c) => c.turn_reason === "missing"))
        throw new Error("E_RUN: driver produced no turn/end event");
    return done.sort((a, b) => a.id.localeCompare(b.id));
};
