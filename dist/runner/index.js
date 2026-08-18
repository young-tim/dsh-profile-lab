import { cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { parseJsonl, projectCell } from '../dsh-adapter/index.js';
const atomic = async (f, x) => { const t = f + '.tmp'; await writeFile(t, JSON.stringify(x) + '\n'); await rename(t, f); };
export const cells = (e) => e.variants.flatMap(v => Array.from({ length: e.repetitions }, (_, i) => ({ id: `${v.id}-${i + 1}`, variant: v.id, case: 'default', repetition: i + 1 })));
export const run = async (e, base, driver) => { await mkdir(base, { recursive: true }); const jf = path.join(base, 'journal.json'); let done = []; try {
    done = JSON.parse(await readFile(jf, 'utf8'));
}
catch {
    done = [];
} for (const p of cells(e)) {
    if (done.some(x => x.id === p.id))
        continue;
    const ws = path.join(base, '.runs', p.id, 'workspace');
    await mkdir(path.dirname(ws), { recursive: true });
    await cp(path.resolve(path.dirname(base), e.workspace_template), ws, { recursive: true, dereference: false });
    const v = e.variants.find(x => x.id === p.variant);
    const out = await new Promise((resolve, reject) => { const c = spawn(driver, ['--variant', v.id, '--workspace', ws], { shell: false, env: { PATH: process.env.PATH ?? '' } }); let s = ''; c.stdout.on('data', b => s += b); c.on('error', reject); c.on('close', n => n === 0 ? resolve(s) : reject(new Error(`driver exit ${n}`))); });
    const events = parseJsonl(out);
    if (!events.some(x => x.type === 'turn/end'))
        throw new Error(`driver produced no turn/end event for ${p.id}`);
    done.push(projectCell(p, events, path.join('.runs', p.id)));
    await atomic(jf, done);
} return done; };
