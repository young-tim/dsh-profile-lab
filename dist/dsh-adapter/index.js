import { readFile } from 'node:fs/promises';
export const parseJsonl = (text) => text.split(/\r?\n/).filter(Boolean).flatMap(line => { try {
    const x = JSON.parse(line);
    return typeof x.type === 'string' ? [x] : [];
}
catch {
    return [];
} });
export const readSession = async (file) => parseJsonl(await readFile(file, 'utf8'));
export const projectCell = (id, events, evidence) => { const end = events.findLast(x => x.type === 'turn/end'); const u = events.filter(x => x.usage).reduce((a, x) => ({ input: a.input + (x.usage?.input ?? 0), output: a.output + (x.usage?.output ?? 0), reasoning: a.reasoning + (x.usage?.reasoning ?? 0), cache: a.cache + (x.usage?.cache ?? 0) }), { input: 0, output: 0, reasoning: 0, cache: 0 }); const final = events.findLast(x => x.type === 'assistant/final')?.text ?? ''; return { ...id, status: end?.status === 'ok' ? 'pass' : end?.status === 'cancelled' ? 'cancelled' : end?.status === 'fail' ? 'fail' : 'error', attempts: 1, duration_ms: end?.duration_ms ?? 0, steps: end?.steps ?? events.filter(x => x.type === 'step/end').length, tool_calls: events.filter(x => x.type === 'tool/call').length, tool_errors: events.filter(x => x.type === 'tool/error').length, input_tokens: u.input, output_tokens: u.output, reasoning_tokens: u.reasoning, cache_tokens: u.cache, final_output_hash: awaitHash(final), evidence }; };
import { createHash } from 'node:crypto';
const awaitHash = (x) => createHash('sha256').update(x).digest('hex');
