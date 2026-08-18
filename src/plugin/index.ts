import { loadExperiment } from '../config/index.js'; import { run } from '../runner/index.js'; import { report } from '../report/index.js'; import { readFile } from 'node:fs/promises'; import path from 'node:path';
export const profile_lab_run=async(input:{experiment:string;output:string;driver:string})=>run(await loadExperiment(input.experiment),input.output,input.driver);
export const profile_lab_compare=async(input:{experiment:string;output:string})=>report(input.output,await loadExperiment(input.experiment),JSON.parse(await readFile(path.join(input.output,'journal.json'),'utf8')));
export const profile_lab_gate=async()=>{throw new Error('use CLI gate with an explicit policy');};
export const apply=(ctx:{tool?:(name:string, fn:unknown)=>void})=>{ctx.tool?.('profile_lab_run',profile_lab_run);ctx.tool?.('profile_lab_compare',profile_lab_compare);ctx.tool?.('profile_lab_gate',profile_lab_gate);};
