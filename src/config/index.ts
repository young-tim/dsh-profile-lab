import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { Experiment } from '../types.js';

const fail = (message: string): never => { throw new Error(message); };
const safePath = (value: string, label: string) => {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) fail(`invalid ${label} path`);
};
export const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export const loadExperiment = async (file: string): Promise<Experiment> => {
  const doc = YAML.parseDocument(await readFile(file, 'utf8'), { uniqueKeys: true, merge: false, prettyErrors: false });
  if (doc.errors.length || doc.warnings.length || doc.contents === null) fail(`invalid YAML: ${doc.errors.concat(doc.warnings).map(String).join('; ')}`);
  const x = doc.toJS() as Record<string, unknown>;
  const allowed = ['schema_version', 'name', 'cases_dir', 'workspace_template', 'baseline', 'variants', 'repetitions', 'run', 'pricing', 'gate'];
  for (const key of Object.keys(x)) if (!allowed.includes(key)) fail(`unknown top-level field: ${key}`);
  const name = x.name, casesDir = x.cases_dir, template = x.workspace_template, baseline = x.baseline, repetitions = x.repetitions, variantsRaw = x.variants;
  if (x.schema_version !== 1 || typeof name !== 'string' || typeof casesDir !== 'string' || typeof template !== 'string' || typeof baseline !== 'string' || !Array.isArray(variantsRaw) || variantsRaw.length < 2 || !Number.isInteger(repetitions) || !x.run) fail('experiment contract invalid');
  safePath(casesDir as string, 'cases_dir'); safePath(template as string, 'workspace_template');
  const variants = variantsRaw as Record<string, unknown>[]; const ids = new Set<string>();
  for (const v of variants) { const id = v.id, profile = v.profile, patch = v.patch; if (typeof id !== 'string' || typeof profile !== 'string' || typeof patch !== 'string' || ids.has(id as string)) fail('invalid or duplicate variant'); ids.add(id as string); safePath(patch as string, 'patch'); }
  if (!ids.has(baseline as string)) fail('baseline variant missing');
  const run = x.run as Record<string, unknown>; const concurrency = run.concurrency, timeout = run.timeout_ms, maxRuns = run.max_runs, maxTokens = run.max_total_tokens;
  if (!Number.isInteger(concurrency) || Number(concurrency) < 1 || Number(concurrency) > 8 || !Number.isInteger(timeout) || !Number.isInteger(maxRuns) || !Number.isInteger(maxTokens)) fail('invalid run settings');
  const experiment = x as unknown as Experiment;
  if (experiment.variants.length * experiment.repetitions > experiment.run.max_runs) fail('max_runs exceeded');
  return experiment;
};
export const containedRealpath = async (root: string, target: string) => { const [r, t] = await Promise.all([realpath(root), realpath(target)]); if (t !== r && !t.startsWith(r + path.sep)) fail('path escapes root'); return t; };
