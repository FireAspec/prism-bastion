import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const npm=process.platform==='win32'?'npm.cmd':'npm';
const jobs=[
 ['integration',['exec','--','vitest','run','tests/integration']],
 ['project',['run','check']]
];
let failed=false;
for(const [name,args] of jobs){
 console.log('\n=== '+name+' ===');
 const r=spawnSync(npm,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});
 console.log(JSON.stringify({name,status:r.status,signal:r.signal,error:r.error?.message??null}));
 if(r.status!==0||r.error)failed=true;
}
process.exitCode=failed?1:0;
