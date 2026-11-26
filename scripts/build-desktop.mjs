import {build} from 'vite';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const mode=process.argv[2];
if(!['build','dev','pack'].includes(mode))throw Error('Expected build, dev or pack');
function npm(args){
 const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{stdio:'inherit',shell:process.platform==='win32',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('npm failed: '+result.status);
}
npm(['run','build']);
const output=path.join(root,'dist','desktop');
await mkdir(output,{recursive:true});
await build({configFile:false,build:{ssr:path.join(root,'desktop/host.ts'),target:'node22',outDir:output,emptyOutDir:false,minify:false,rollupOptions:{external:['ws','electron'],output:{format:'cjs',entryFileNames:'host.cjs',chunkFileNames:'host-[name]-[hash].cjs'}}}});
for(const name of ['main.cjs','preload.cjs','host-control.cjs'])await copyFile(path.join(root,'desktop',name),path.join(output,name));
const htmlPath=path.join(root,'dist','index.html');
let html=await readFile(htmlPath,'utf8');
const policy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob: data:; connect-src ws: wss:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
if(!/<head(?:\s[^>]*)?>/i.test(html))throw Error('Missing renderer head');
html=html.replace(/<head(?:\s[^>]*)?>/i,tag=>tag+'<meta http-equiv="Content-Security-Policy" content="'+policy+'">');
await writeFile(htmlPath,html);
if(mode==='dev')npm(['exec','--offline','--','electron','.']);
if(mode==='pack'){
 if(process.platform!=='win32')throw Error('Windows packaging requires a Windows runner');
 npm(['exec','--offline','--','electron-builder','--config','desktop/builder.json','--win','--x64','--publish','never']);
}
