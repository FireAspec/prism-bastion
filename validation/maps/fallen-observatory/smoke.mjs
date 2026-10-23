/** Dependency-free geometry check using the actual TypeScript sources.
 * Restricted VM deliberately has no I/O, network or process capabilities.
 */
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext,Script} from 'node:vm';
const files=[
 'src/contracts/geometry.ts','src/content/maps/fallen-observatory.ts',
 'validation/maps/fallen-observatory/geometry.ts',
 'validation/maps/fallen-observatory/replays.ts',
];
const code=files.map(path=>stripTypeScriptTypes(readFileSync(resolve(path),'utf8'),{mode:'strip'})
 .replace(/^import .*;\s*$/gm,'').replace(/\bexport\s+(?=async\s+function\s|function\s|const\s)/g,'')).join('\n');
const assessment=`{
 const geometry=analyzeGeometry(getMap());
 const fixtures=candidates.map(c=>({id:c.id,status:c.status,mode:c.modeId,steps:c.steps.length,
  insufficientBasePurchases:basePurchaseLedger(c).filter(r=>r.afterIgnoringKillIncomeAndUpgradeCosts<0)}));
 const collisionPolygons=[...getMap().blocked,...getMap().water].map(poly=>poly.map(p=>p.x+','+p.y).join(' '));
 JSON.stringify({ok:geometry.ok&&fixtures.length===3&&fixtures.every(f=>f.status==='unverified'&&!f.insufficientBasePurchases.length),geometry,fixtures,collisionPolygons});
}`;
const json=runInNewContext(`${code}\n${assessment}`,{JSON,Math,Number,Object,Set,Map,structuredClone,process:{argv:[null]}});
const report=JSON.parse(json);
const background=readFileSync('public/art/maps/fallen-observatory/background.svg','utf8');
const thumbnail=readFileSync('public/art/maps/fallen-observatory/thumbnail.svg','utf8');
const preview=readFileSync('public/art/maps/fallen-observatory/preview.html','utf8');
const scriptBody=preview.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!scriptBody)throw new Error('Preview script not present');
new Script(scriptBody,{filename:'fallen-observatory/preview.html'});
for(const path of ['tests/maps/fallen-observatory.test.ts','validation/maps/fallen-observatory/validate.ts']){
 const js=stripTypeScriptTypes(readFileSync(path,'utf8'),{mode:'strip'}).replace(/^import .*;\s*$/gm,'');
 new Script(js,{filename:path});
}
const artPolygons=[...background.matchAll(/<polygon points="([^"]+)"/g)].map(m=>m[1]);
report.assetParity=JSON.stringify(artPolygons.sort())===JSON.stringify(report.collisionPolygons.sort());
report.assetsValid=report.assetParity&&background.includes('viewBox="0 0 1280 720"')&&
 thumbnail.includes('viewBox="0 0 640 360"')&&preview.includes('background.svg');
delete report.collisionPolygons;
report.ok=report.ok&&report.assetsValid;
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(!report.ok)process.exitCode=1;
