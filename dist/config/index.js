import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
const fail = (message) => { throw new Error(message); };
const safePath = (value, label) => {
    if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes('..'))
        fail(`invalid ${label} path`);
};
export const hash = (data) => createHash('sha256').update(data).digest('hex');
export const loadExperiment = async (file) => {
    const doc = YAML.parseDocument(await readFile(file, 'utf8'), { uniqueKeys: true, merge: false, prettyErrors: false });
    if (doc.errors.length || doc.warnings.length || doc.contents === null)
        fail(`invalid YAML: ${doc.errors.concat(doc.warnings).map(String).join('; ')}`);
    const x = doc.toJS();
    const allowed = ['schema_version', 'name', 'cases_dir', 'workspace_template', 'baseline', 'variants', 'repetitions', 'run', 'pricing', 'gate'];
    for (const key of Object.keys(x))
        if (!allowed.includes(key))
            fail(`unknown top-level field: ${key}`);
    const name = x.name, casesDir = x.cases_dir, template = x.workspace_template, baseline = x.baseline, repetitions = x.repetitions, variantsRaw = x.variants;
    if (x.schema_version !== 1 || typeof name !== 'string' || typeof casesDir !== 'string' || typeof template !== 'string' || typeof baseline !== 'string' || !Array.isArray(variantsRaw) || variantsRaw.length < 2 || !Number.isInteger(repetitions) || !x.run)
        fail('experiment contract invalid');
    safePath(casesDir, 'cases_dir');
    safePath(template, 'workspace_template');
    const variants = variantsRaw;
    const ids = new Set();
    for (const v of variants) {
        const id = v.id, profile = v.profile, patch = v.patch;
        if (typeof id !== 'string' || typeof profile !== 'string' || typeof patch !== 'string' || ids.has(id))
            fail('invalid or duplicate variant');
        ids.add(id);
        safePath(patch, 'patch');
    }
    if (!ids.has(baseline))
        fail('baseline variant missing');
    const run = x.run;
    const concurrency = run.concurrency, timeout = run.timeout_ms, maxRuns = run.max_runs, maxTokens = run.max_total_tokens;
    if (!Number.isInteger(concurrency) || Number(concurrency) < 1 || Number(concurrency) > 8 || !Number.isInteger(timeout) || !Number.isInteger(maxRuns) || !Number.isInteger(maxTokens))
        fail('invalid run settings');
    const experiment = x;
    if (experiment.variants.length * experiment.repetitions > experiment.run.max_runs)
        fail('max_runs exceeded');
    return experiment;
};
export const containedRealpath = async (root, target) => { const [r, t] = await Promise.all([realpath(root), realpath(target)]); if (t !== r && !t.startsWith(r + path.sep))
    fail('path escapes root'); return t; };
