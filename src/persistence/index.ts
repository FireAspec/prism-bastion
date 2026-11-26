import type {GameConfig, GameState, Profile, SaveEnvelope, SaveStore} from '../contracts';
import {INITIAL_TOWERS} from '../contracts/story';
import {legalTiers} from '../contracts/rules';

export const SAVE_KEY = 'prism-bastion.save';
export const BACKUP_KEY = SAVE_KEY + '.backup';
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;
export type PersistedSave = SaveEnvelope & {contentDigest?: string};
export class SaveError extends Error {
  constructor(public readonly code: 'invalid'|'version'|'size'|'storage'|'corrupt'|'ledger', message: string) {
    super(message); this.name = 'SaveError';
  }
}
export function defaultProfile(): Profile {
  return {version:1, settings:{master:1,music:0.7,sfx:0.8,language:'ru',fullscreen:false,reducedMotion:false,quality:'high',colorblind:false},
    medals:{},unlockedCosmetics:[],bestWave:{},completedRuns:0,tutorialSeen:false,completedNodes:[],unlockedTowers:[...INITIAL_TOWERS],
    xp:0,level:1,seals:0,knowledgePoints:0,knowledgeUnlocked:[],knowledgePaid:[],claimedRuns:[],respecCount:0};
}

type Obj = Record<string, unknown>;
type Check = (v:unknown,p:string)=>void;
const fail = (p:string):never => {throw new SaveError('invalid', `Invalid save field: ${p}`);};
function obj(v:unknown,p:string):Obj {
  if(v===null || typeof v!=='object' || Array.isArray(v)) return fail(p);
  return v as Obj;
}
const num = (min=0,max=Number.MAX_SAFE_INTEGER,integer=false):Check => (v,p)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isSafeInteger(v))) fail(p);
};
const n=num(), signed=num(-Number.MAX_SAFE_INTEGER), int=num(0,Number.MAX_SAFE_INTEGER,true), positive=num(1,Number.MAX_SAFE_INTEGER,true);
const bool:Check=(v,p)=>{if(typeof v!=='boolean')fail(p);};
const str:Check=(v,p)=>{if(typeof v!=='string'||v.length>4096)fail(p);};
const id:Check=(v,p)=>{if(typeof v!=='string'||v.length<1||v.length>256)fail(p);};
const one=(...values:unknown[]):Check=>(v,p)=>{if(!values.includes(v))fail(p);};
const optional=(c:Check):Check=>(v,p)=>{if(v!==undefined)c(v,p);};
const nullable=(c:Check):Check=>(v,p)=>{if(v!==null)c(v,p);};
const array=(c:Check,max=50000):Check=>(v,p)=>{
  if(!Array.isArray(v)||v.length>max)return fail(p);
  v.forEach((x,i)=>c(x,`${p}[${i}]`));
};
const unique=(v:unknown,p:string)=>{if(!Array.isArray(v)||new Set(v).size!==v.length)fail(p);};
const ids:Check=(v,p)=>{array(id)(v,p);unique(v,p);};
const record=(c:Check):Check=>(v,p)=>{for(const [k,x] of Object.entries(obj(v,p))){id(k,p);c(x,`${p}.${k}`);}};
const shape=(fields:Record<string,Check>):Check=>(v,p)=>{const o=obj(v,p);for(const [k,c] of Object.entries(fields))c(o[k],`${p}.${k}`);};
const vec=shape({x:signed,y:signed});
const difficulty=one('easy','normal','hard','extreme');
const element=one('kinetic','fire','frost','electric','acid','energy');
const statusFields={kind:one('burn','poison','slow','freeze','stun','mark','shred','wet','reveal'),power:n,duration:n,maxStacks:optional(positive)};
const attack=shape({mode:one('shot','cone','beam','chain','splash','ring','mortar','mine','drone','pulse','tide','melee'),element,damage:n,interval:num(0.05),range:n,pierce:int,count:int,splash:n,chains:int,chainRadius:n,detects:bool,armorPierce:n,shieldMultiplier:n,bossMultiplier:n,executeBelow:num(0,1),push:n,statuses:array(shape(statusFields)),projectileSpeed:n,projectileRadius:n,homing:bool,windup:n,arc:num(0,360)});
const settings=shape({master:num(0,1),music:num(0,1),sfx:num(0,1),language:one('ru','en'),fullscreen:bool,reducedMotion:bool,quality:one('low','high'),colorblind:bool});
const profileCheck=shape({version:one(1),settings,medals:record(int),unlockedCosmetics:ids,bestWave:record(int),completedRuns:int,tutorialSeen:bool,completedNodes:ids,unlockedTowers:ids,xp:int,level:positive,seals:int,knowledgePoints:int,knowledgeUnlocked:ids,knowledgePaid:ids,claimedRuns:ids,respecCount:int});
const player=shape({id,name:(v,p)=>{str(v,p);if((v as string).length>24)fail(p);},color:str,connected:bool});
const rules=shape({incomeMul:n,startingCashMul:n,enemyHpMul:n,enemySpeedMul:n,towerCostMul:n,sellAllowed:bool,maxLives:positive,allowAbilities:bool,allowPassiveIncome:bool,maxTowers:int,maxTier:num(0,5,true),weather:one('none','alternating','fog'),allowKnowledge:bool,rounds:positive,roundRewardBase:n,roundRewardStep:n,popCashMul:n});
const tiers:Check=(v,p)=>{array(int,3)(v,p);if((v as number[]).length!==3||!legalTiers(v as [number,number,number]))fail(p);};
const tower=shape({id,defId:id,owner:id,pos:vec,tiers,targeting:one('first','last','strong','near'),invested:positive,cooldown:signed,abilityCooldowns:record(signed),memory:record(signed),damageDealt:n,kills:int,generated:n});
const paidLayers:Check=(v,p)=>{array(int)(v,p);unique(v,p);};
const enemy=shape({id,defId:id,lane:int,progress:n,pos:vec,hp:n,maxHp:num(Number.MIN_VALUE),shield:n,maxShield:n,statuses:array(shape({...statusFields,source:id,remaining:n,stacks:positive})),memory:record(signed),bountyPaid:bool,generation:num(0,3,true),paidLayers});
const event=shape({id:int,time:n,kind:one('shot','projectileSpawn','projectileImpact','strikeStart','strikeContact','miss','hit','layerBreak','shieldBreak','kill','leak','spawn','upgrade','place','sell','ability','bossPhase','waveStart','waveEnd','victory','defeat','income'),source:optional(id),target:optional(id),pos:optional(vec),to:optional(vec),amount:optional(signed),element:optional(element),visual:optional(str),layer:optional(int),fromVisual:optional(str),toVisual:optional(str)});
const projectile=shape({id,source:id,pos:vec,previous:vec,velocity:vec,target:nullable(id),remainingLife:signed,remainingPierce:int,hitTargets:ids,attack,visual:str});
const strike=shape({id,source:id,pos:vec,direction:vec,remainingWindup:signed,remainingActive:signed,attack,hitTargets:ids,visual:str});
const runCheck=shape({version:one(1),options:shape({mapId:id,difficulty,seed:num(-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,true),endless:bool,modeId:id,unlockedTowers:ids,players:array(player,4),runId:id,knowledge:ids}),phase:one('build','wave','victory','defeat'),time:n,rules,tick:int,rng:num(0,0xffffffff,true),nextEntity:int,nextEvent:int,credits:int,lives:int,wave:int,waveTime:n,spawnCursor:array(int),paused:bool,speed:one(1,2,3),autoStart:bool,towers:array(tower,60),enemies:array(enemy,1800),events:array(event),projectiles:array(projectile),strikes:array(strike),stats:shape({spent:int,earned:int,kills:int,damage:n,leaks:int,abilities:int,cashSubunits:num(0,99,true)})});
function validateRun(v:unknown):asserts v is GameState {
  runCheck(v,'run');const s=v as GameState;
  const owners=s.options.players.map(p=>p.id);unique(owners,'run.options.players');
  if(!owners.length)fail('run.options.players');
  unique([...s.towers,...s.enemies,...s.projectiles,...s.strikes].map(e=>e.id),'run entity IDs');
  unique(s.events.map(e=>e.id),'run event IDs');
  if(s.lives>s.rules.maxLives||s.towers.length>s.rules.maxTowers)fail('run rules');
  const t5=new Set<string>();
  for(const t of s.towers){if(!owners.includes(t.owner)||t.tiers.some(x=>x>s.rules.maxTier))fail('run tower owner or tier');
    const path=t.tiers.indexOf(5);if(path>=0){const key=JSON.stringify([t.defId,path]);if(t5.has(key))fail('run duplicate T5');t5.add(key);}}
  for(const e of s.enemies)if(e.hp>e.maxHp||e.shield>e.maxShield)fail('run enemy health');
}

// Reject excessive depth, dangerous dictionary keys and non-JSON numeric values before cloning.
function bounded(v:unknown,depth=0,budget={left:300000}):void {
  if(--budget.left<0||depth>48)throw new SaveError('size','Save structure exceeds limits');
  if(v===null||typeof v==='boolean'||typeof v==='string')return;
  if(typeof v==='number'){if(!Number.isFinite(v))fail('non-finite number');return;}
  if(typeof v!=='object')fail('non-JSON value');
  if(Array.isArray(v)){if(v.length>50000)throw new SaveError('size','Save array exceeds limits');for(const x of v)bounded(x,depth+1,budget);return;}
  const o=v as Obj;const proto=Object.getPrototypeOf(o);if(proto!==Object.prototype&&proto!==null)fail('non-plain object');
  for(const [k,x] of Object.entries(o)){if(k==='__proto__'||k==='constructor'||k==='prototype')fail('unsafe key');if(x!==undefined)bounded(x,depth+1,budget);}
}
function size(raw:string):void {if(typeof raw!=='string'||raw.length>MAX_SAVE_BYTES||new TextEncoder().encode(raw).length>MAX_SAVE_BYTES)throw new SaveError('size','Save exceeds 2 MiB');}
function parse(raw:string):unknown {size(raw);let v:unknown;try{v=JSON.parse(raw);}catch{throw new SaveError('invalid','Invalid save JSON');}bounded(v);return v;}
function serialize(v:unknown):string {bounded(v);const raw=JSON.stringify(v);size(raw);return raw;}
function xpFloor(level:number):number {const m=level-1;return 200*m+20*m*(m+1)+5*m*(m+1)*(2*m+1)/6;}
function levelFor(xp:number):number {let lo=1,hi=2;while(xpFloor(hi)<=xp)hi*=2;while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(xpFloor(mid)<=xp)lo=mid;else hi=mid;}return lo;}
function migrateProfile(value:unknown,legacy:boolean):Profile {
  const p=obj(value,'profile');if(p.version!==undefined&&p.version!==0&&p.version!==1)throw new SaveError('version','Unsupported profile version');
  const d=defaultProfile();const incomplete=legacy||p.version!==1||['xp','level','knowledgePoints','knowledgeUnlocked','knowledgePaid'].some(k=>p[k]===undefined);
  const merged={...d,...p,version:1,settings:{...d.settings,...(p.settings===undefined?{}:obj(p.settings,'profile.settings'))}} as Profile;
  if(incomplete){
    if(p.xp===undefined&&p.level!==undefined){positive(p.level,'profile.level');merged.xp=xpFloor(p.level as number);}
    int(merged.xp,'profile.xp');merged.level=levelFor(merged.xp);
    ids(merged.knowledgeUnlocked,'profile.knowledgeUnlocked');ids(merged.knowledgePaid,'profile.knowledgePaid');
    merged.knowledgePaid=[...new Set([...merged.knowledgePaid,...merged.knowledgeUnlocked])];
    merged.knowledgePoints=Math.max(0,3*Math.min(50,merged.level-1)-merged.knowledgeUnlocked.length);
  }
  profileCheck(merged,'profile');return merged;
}
function decode(raw:string):PersistedSave {
  const o=obj(parse(raw),'save');if(o.version!==0&&o.version!==1)throw new SaveError('version','Unsupported save version');
  const legacy=o.version===0;
  const profile=migrateProfile(o.profile,legacy);
  const savedAt=o.savedAt===undefined&&legacy?'1970-01-01T00:00:00.000Z':o.savedAt;
  if(typeof savedAt!=='string'||!Number.isFinite(Date.parse(savedAt)))fail('savedAt');
  const contentVersion=o.contentVersion===undefined&&legacy?'legacy':o.contentVersion;id(contentVersion,'contentVersion');
  optional(id)(o.contentDigest,'contentDigest');
  // A legacy combat state cannot safely reconstruct paid layers or fractional credits.
  const run=legacy||o.run===undefined?null:o.run;if(run!==null)validateRun(run);
  return {...o,version:1,savedAt,contentVersion,profile,run} as PersistedSave;
}
export function makeSaveEnvelope(profile:Profile,run:GameState|null,config:Pick<GameConfig,'contentVersion'|'contentDigest'>):PersistedSave {
  return {version:1,savedAt:new Date().toISOString(),contentVersion:config.contentVersion,contentDigest:config.contentDigest,profile,run};
}
export type ResumeResult={ok:true;run:GameState}|{ok:false;reason:string};
export function checkResume(value:PersistedSave,config:GameConfig):ResumeResult {
  const s=value.run;const no=(reason:string):ResumeResult=>({ok:false,reason});
  if(!s)return no('Нет сохранённого забега.');
  if(value.contentDigest!==config.contentDigest)return no('Версия игровых данных изменилась или неизвестна. Профиль сохранён.');
  const map=config.maps.find(m=>m.id===s.options.mapId);if(!map)return no(`Неизвестная карта: ${s.options.mapId}`);
  if(!config.modes.some(m=>m.id===s.options.modeId))return no(`Неизвестный режим: ${s.options.modeId}`);
  if(!config.difficulties.some(d=>d.id===s.options.difficulty))return no(`Неизвестная сложность: ${s.options.difficulty}`);
  const towers=new Set(config.towers.map(t=>t.id));
  for(const t of [...s.options.unlockedTowers,...s.towers.map(t=>t.defId)])if(!towers.has(t))return no(`Неизвестная башня: ${t}. Профиль сохранён.`);
  const knowledge=new Set(config.knowledge.map(k=>k.id));for(const k of s.options.knowledge)if(!knowledge.has(k))return no(`Неизвестное знание: ${k}`);
  for(const e of s.enemies){const d=config.enemies.find(x=>x.id===e.defId);if(!d)return no(`Неизвестный противник: ${e.defId}`);
    if(!map.lanes[e.lane]||e.paidLayers.some(i=>i>=d.layers.length))return no(`Несовместимое состояние противника: ${e.id}`);}
  return {ok:true,run:s};
}

export interface LocalSaveStore extends SaveStore {readonly recoveredFromBackup:boolean; load():PersistedSave; import(json:string):PersistedSave;}
export function createSaveStore(storage:Storage):LocalSaveStore {
  let recovered=false;
  const read=(key:string):string|null=>{try{return storage.getItem(key);}catch{throw new SaveError('storage','Cannot read save storage');}};
  const write=(key:string,raw:string):void=>{try{storage.setItem(key,raw);}catch{throw new SaveError('storage','Cannot write save storage (quota or access)');}};
  function current():{value:PersistedSave;raw:string|null} {
    recovered=false;const primary=read(SAVE_KEY),backup=read(BACKUP_KEY);
    if(primary!==null){try{return {value:decode(primary),raw:primary};}catch(e){if(e instanceof SaveError&&e.code==='version')throw e;}}
    if(backup!==null){try{const value=decode(backup);recovered=true;return {value,raw:backup};}catch(e){if(e instanceof SaveError&&e.code==='version')throw e;}}
    if(primary!==null||backup!==null)throw new SaveError('corrupt','Both save copies are invalid; no progress was reset');
    return {value:{version:1,savedAt:new Date().toISOString(),contentVersion:'uninitialized',profile:defaultProfile(),run:null},raw:null};
  }
  function commit(value:PersistedSave,restoreCorrupt=false):void {
    // Validate the entire replacement before the first storage write.
    const next=decode(serialize(value));const raw=serialize(next);
    let old:ReturnType<typeof current>;
    try{old=current();}catch(e){
      if(!restoreCorrupt||!(e instanceof SaveError)||e.code!=='corrupt')throw e;
      // Explicit import is the recovery action when no valid copy can be decoded.
      write(BACKUP_KEY,raw);write(SAVE_KEY,raw);recovered=false;return;
    }
    const claims=new Set(next.profile.claimedRuns);
    if(old.value.profile.claimedRuns.some(id=>!claims.has(id)))throw new SaveError('ledger','Save would discard previously claimed run IDs; import a current profile instead');
    if(old.raw!==null)write(BACKUP_KEY,old.raw);else write(BACKUP_KEY,raw);
    write(SAVE_KEY,raw);recovered=false;
  }
  return {get recoveredFromBackup(){return recovered;},load(){return current().value;},save(value){commit(value);},export(){return serialize(current().value);},import(json){const value=decode(json);commit(value,true);return value;},reset(){
    try{storage.removeItem(BACKUP_KEY);storage.removeItem(SAVE_KEY);recovered=false;}catch{throw new SaveError('storage','Cannot reset save storage');}
  }};
}
