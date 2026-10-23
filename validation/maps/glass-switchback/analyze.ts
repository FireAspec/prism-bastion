import {getMap} from '../../../src/content/maps/glass-switchback';
import {distance} from '../../../src/contracts/geometry';
import {analyzeMap,legalSite} from './geometry';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {ReplayFixture} from './replay';

export function analyzeCandidates(fixture:ReplayFixture) {
 const errors:string[]=[];
 const map=getMap();
 if(fixture.mapId!==map.id||fixture.rounds!==80||fixture.difficulty!=='hard')errors.push('Incorrect map or difficulty in fixture');
 if(new Set(fixture.availableAtFirstArrival).size!==25||fixture.availableAtFirstArrival.includes('mine'))errors.push('Roster must contain exactly 25 unique pre-mine towers');
 const expected=['standard','half-cash','iron-oath'];
 if(fixture.candidates.length!==3||expected.some(mode=>!fixture.candidates.some(c=>c.modeId===mode)))errors.push('All three modes need a candidate');
 for(const candidate of fixture.candidates){
  if(candidate.status!=='unverified')errors.push(`${candidate.id}: replay cannot be marked verified without engine evidence`);
  if(candidate.startingCredits!==(candidate.modeId==='half-cash'?425:850))errors.push(`${candidate.id}: incorrect starting budget`);
  if(candidate.startingLives!==(candidate.modeId==='iron-oath'?1:100))errors.push(`${candidate.id}: incorrect life count`);
  const placed=new Map<string,{pos:{x:number;y:number};radius:number;tower:string}>();
  let firstWaveSpend=0,lastWave=0;
  for(const a of candidate.actions){
   if(a.beforeWave<1||a.beforeWave>80||a.beforeWave<lastWave||a.tick!==0)errors.push(`${candidate.id}: invalid action order`);
   lastWave=a.beforeWave;
   if(a.type==='upgrade'){
    if(!placed.has(a.target)||![0,1,2].includes(a.path))errors.push(`${candidate.id}: invalid upgrade ${a.target}`);
    continue;
   }
   if(!fixture.availableAtFirstArrival.includes(a.tower))errors.push(`${candidate.id}: unavailable tower ${a.tower}`);
   if(placed.has(a.key))errors.push(`${candidate.id}: duplicate alias ${a.key}`);
   const radius=26;
   if(!legalSite(a.pos,radius,'land',map))errors.push(`${candidate.id}: illegal placement ${a.key} (${a.pos.x},${a.pos.y})`);
   for(const [name,previous] of placed)if(distance(previous.pos,a.pos)<previous.radius+radius+4)errors.push(`${candidate.id}: overlapping ${name}/${a.key}`);
   placed.set(a.key,{pos:a.pos,radius,tower:a.tower});
   if(a.beforeWave===1)firstWaveSpend+=a.baseHardCost;
  }
  if(firstWaveSpend>candidate.startingCredits)errors.push(`${candidate.id}: opening cost exceeds credits`);
  if(candidate.modeId==='iron-oath'&&[...placed.values()].some(p=>['mint','orchard','bank'].includes(p.tower)))errors.push(`${candidate.id}: income tower disallowed in iron oath`);
 }
 return {errors,modeCount:fixture.candidates.length,actionCount:fixture.candidates.reduce((n,c)=>n+c.actions.length,0)};
}

const thisFile=fileURLToPath(import.meta.url);
if(process.argv[1]&&fileURLToPath(new URL(`file://${process.argv[1]}`))===thisFile){
 const fixture=JSON.parse(readFileSync(new URL('./replay-candidates.json',import.meta.url),'utf8')) as ReplayFixture;
 const geometry=analyzeMap(),candidates=analyzeCandidates(fixture);
 const result={geometry,candidates,errors:[...geometry.errors,...candidates.errors]};
 console.log(JSON.stringify(result,null,2));
 if(result.errors.length)process.exitCode=1;
}
