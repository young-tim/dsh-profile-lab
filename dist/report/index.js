import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { summarize } from '../stats/index.js';
const esc = (x) => x.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const put = async (f, s) => { await mkdir(path.dirname(f), { recursive: true }); await writeFile(f + '.tmp', s); await rename(f + '.tmp', f); };
export const report = async (dir, e, cells) => { const variants = e.variants.map(v => summarize(cells, v.id)); const data = { version: 1, experiment: e.name, variants, cells }; await put(path.join(dir, 'report.json'), JSON.stringify(data, null, 2) + '\n'); const md = `# ${e.name}\n\n| Variant | Pass rate | Median tokens |\n|---|---:|---:|\n${variants.map(v => `| ${v.variant} | ${v.pass_rate} | ${v.median_tokens} |`).join('\n')}\n`; await put(path.join(dir, 'report.md'), md); await put(path.join(dir, 'report.html'), `<!doctype html><meta charset="utf-8"><title>${esc(e.name)}</title><pre>${esc(md)}</pre>`); return data; };
