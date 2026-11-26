import type { GameConfig, TowerDef, MapDef, KnowledgeNode, EnemyDef, WaveDef, AttackDef, Vec } from '../contracts';
import { INITIAL_TOWERS, START_CREDITS, START_LIVES } from '../contracts/story';
import { getEnemies } from './enemies';
import { getBosses } from './bosses';
import { getWaves, getEndlessWave } from './waves';
import { getCampaign } from './campaign';
import { getEconomy } from './economy';
import { getModes, getDifficulties } from '../modes';
import { towerFactories, mapFactories, knowledgeFactories, resourceHashes } from './generated';
import { CONTENT_VERSION, byId, assetKey, resourceKeys, contentDigest, canonical } from './manifest';
export { createManifest, reconcileCampaignRewards, compatibilityError } from './manifest';

const baseTowers = 'needle cannon rail scatter saw ember frost tesla venom prism mortar rocket drone mine resonator chrono gravity mirror portal storm beacon forge observatory mint bank orchard harbor tide coral bastion'.split(' ');
const baseMaps = 'lantern-garden copper-creek windmill-fields old-aqueduct orchard-wall freight-yard bell-foundry tidal-docks salt-marsh coral-gate clock-square fallen-observatory prism-quarry mirror-terrace glass-switchback fracture-bridge vault-district storm-coast black-lighthouse heart-of-storm'.split(' ');
const baseEnemies = 'scarlet amber lemon jade azure violet iron glass cloak regrow shield split ruby glacier copper obsidian dart swarm aegis royal hollow prismatic juggernaut herald'.split(' ');
const bosses = ['boss-carapace','boss-brood','boss-mirror','boss-chrono','boss-tempest','boss-eclipse'];
const modes = 'standard half-cash no-leaks iron-oath short-supply blackout stormfront overdrive low-tech no-actives'.split(' ');
const branches = ['ballistics','elements','engineering','commerce','lighthouse'];
const stats = 'weaponDamage weaponSpeed weaponRange elementDamage statusDuration shieldDamage supportRadius abilityCooldown controlDuration startingCash passiveIncome purchaseDiscount lives bossDamage revealRadius xpGain sealGain waterDamage waterRange'.split(' ');
const elements = ['kinetic','fire','frost','electric','acid','energy'];
const attacks = 'shot cone beam chain splash ring mortar mine drone pulse tide melee'.split(' ');
const statuses = 'burn poison slow freeze stun mark shred wet reveal'.split(' ');
const finite = (v:number,min=0,max=Infinity):boolean => Number.isFinite(v)&&v>=min&&v<=max;
const integer = (v:number,min=0,max=Number.MAX_SAFE_INTEGER):boolean => Number.isSafeInteger(v)&&v>=min&&v<=max;
const idOK = (id:string):boolean => typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id);
const textOK = (v:string):boolean => typeof v==='string'&&v.trim().length>0;
const validPoint = (p:Vec):boolean => !!p&&finite(p.x)&&finite(p.y); // lane endpoints may be outside the world; handled separately

export function validateContent(config:GameConfig, hashes:Readonly<Record<string,string>>=resourceHashes):string[] {
  const errors:string[]=[];
  const check=(ok:boolean,message:string)=>{if(!ok)errors.push(message);};
  function unique<T>(items:readonly T[], get:(v:T)=>string, label:string):Set<string>{
    const result=new Set<string>();
    for(const item of items){const id=get(item);check(idOK(id),`${label}: invalid ID ${id}`);check(!result.has(id),`${label}: duplicate ID ${id}`);result.add(id);}
    return result;
  }
  function requireIDs(ids:Set<string>, expected:readonly string[], label:string){for(const id of expected)check(ids.has(id),`${label}: missing ${id}`);}
  function graph<T extends {id:string}>(nodes:readonly T[], deps:(n:T)=>readonly string[],label:string){
    const by=new Map(nodes.map(n=>[n.id,n]));
    const marks=new Map<string,number>();
    const visit=(id:string)=>{
      if(marks.get(id)===1){errors.push(`${label}: cycle at ${id}`);return;}
      if(marks.get(id)===2)return;
      const node=by.get(id);if(!node)return;
      marks.set(id,1);
      const seen=new Set<string>();
      for(const dep of deps(node)){check(!seen.has(dep),`${label}/${id}: duplicate prerequisite ${dep}`);seen.add(dep);check(by.has(dep),`${label}/${id}: unknown prerequisite ${dep}`);visit(dep);}
      marks.set(id,2);
    };
    for(const n of nodes)visit(n.id);
  }
  try {
    check(config.version===1,'Unsupported schema');
    check(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(config.contentVersion),'Invalid content version');
    check(config.sellRatio===0.7,'Invalid sell ratio');
    check(integer(config.startCredits,1)&&integer(config.startLives,1),'Invalid starting resources');
    check(config.knowledgeDiscount===0,'Catalog knowledge discount must be zero');
    const towers=unique(config.towers,t=>t.id,'towers'), maps=unique(config.maps,m=>m.id,'maps'), enemies=unique(config.enemies,e=>e.id,'enemies'), modeIds=unique(config.modes,m=>m.id,'modes'), nodeIds=unique(config.campaign,n=>n.id,'campaign');
    const knowledge=unique(config.knowledge,k=>k.id,'knowledge');
    requireIDs(towers,baseTowers,'towers');requireIDs(maps,baseMaps,'maps');requireIDs(enemies,[...baseEnemies,...bosses],'enemies');requireIDs(modeIds,modes,'modes');
    const checkStatus=(s:AttackDef['statuses'][number],label:string)=>{check(statuses.includes(s.kind)&&finite(s.power)&&finite(s.duration,Number.MIN_VALUE)&& (s.maxStacks===undefined||integer(s.maxStacks,1)),`${label}: invalid status ${s.kind}`);};
    function checkAttack(a:AttackDef,label:string){
      check(attacks.includes(a.mode)&&elements.includes(a.element),`${label}: invalid attack kind`);
      check(finite(a.interval,.05)&&integer(a.count,1)&&integer(a.pierce,0)&&integer(a.chains),`${label}: invalid attack timing/count`);
      for(const key of ['damage','range','splash','chainRadius','armorPierce','shieldMultiplier','bossMultiplier','push','projectileSpeed','projectileRadius','windup'] as const)check(finite(a[key]),`${label}: invalid ${key}`);
      check(finite(a.executeBelow,0,1)&&finite(a.arc,0,360),`${label}: invalid execute/arc`);
      for(const s of a.statuses)checkStatus(s,label);
    }
    function checkEffects(items:TowerDef['effects'],label:string){
      unique(items,e=>e.id,`${label}/effects`);
      for(const e of items){check(['aura','income','interest','charge','focus','deathBurst','copy','portal','barrier','harvest','trap','echo'].includes(e.kind),`${label}: invalid effect kind ${e.kind}`);for(const k of ['power','radius','interval','duration','cap'] as const)check(finite(e[k]),`${label}: invalid effect ${e.id}/${k}`);if(e.status)checkStatus(e.status,label);if(e.kind==='aura')check(!!e.stat&&['damage','attackSpeed','range','armorPierce','detect','discount'].includes(e.stat),`${label}: aura without valid stat`);}
    }
    function checkAbilities(items:TowerDef['abilities'],label:string){unique(items,a=>a.id,`${label}/abilities`);for(const a of items){check(['nova','overclock','meteor','rewind','barrier','mint'].includes(a.kind)&&finite(a.cooldown,Number.MIN_VALUE)&&finite(a.power)&&finite(a.duration)&&finite(a.radius)&&elements.includes(a.element)&&textOK(a.name)&&textOK(a.description),`${label}: invalid ability ${a.id}`);}}
    function checkVisual(v:TowerDef['visual'],dir:string,expected:string,label:string){
      check(assetKey(v.asset,dir)===`${dir}/${expected}`,`${label}: expected visual ${expected}`);
      check(['none','rotate','pulse','orbit','breathe'].includes(v.motion)&&[v.accent,v.muzzle,v.projectile,v.impact].every(textOK)&&finite(v.scale,Number.MIN_VALUE)&&finite(v.glow),`${label}: invalid visual`);
    }
    for(const t of config.towers){
      const label=`tower/${t.id}`,dir=`art/towers/${t.id}`;
      check(integer(t.cost,1)&&finite(t.footprint,Number.MIN_VALUE)&&textOK(t.name)&&textOK(t.description),`${label}: invalid base`);
      check(['weapon','element','tech','support','economy','water'].includes(t.category)&&['land','water','either'].includes(t.placement),`${label}: invalid category/placement`);
      checkAttack(t.attack,label);checkEffects(t.effects,label);checkAbilities(t.abilities,label);checkVisual(t.visual,dir,'base.svg',label);
      check(t.paths.length===3,`${label}: expected 3 upgrade paths`);unique(t.paths,p=>p.id,`${label}/paths`);
      unique(t.paths.flatMap(p=>p.upgrades),u=>u.id,`${label}/upgrades`);
      for(const [i,p] of t.paths.entries()){
        check(p.upgrades.length===5,`${label}/${p.id}: expected 5 upgrades`);
        for(const [j,u] of p.upgrades.entries()){
          const l=`${label}/${p.id}/${u.id}`;
          check(u.tier===j+1&&integer(u.cost,1)&&textOK(u.name)&&textOK(u.description),`${l}: invalid tier/cost/text`);
          check(!u.replaceAttack||j>=2,`${l}: replaceAttack forbidden at T1/T2`);
          if(u.replaceAttack)checkAttack(u.replaceAttack,l);
          for(const [k,v] of Object.entries(u.delta))check(typeof v==='boolean'?k==='detects':Number.isFinite(v),`${l}: invalid delta ${k}`);
          for(const s of u.addStatuses??[])checkStatus(s,l);
          checkEffects(u.effects??[],l);checkAbilities(u.abilities??[],l);
          checkVisual(u.visual,dir,`${'abc'[i]}${j+1}.svg`,l);
        }
      }
    }
    const mapIndices=new Set<number>();
    for(const m of config.maps){
      const l=`map/${m.id}`;
      check(integer(m.campaignIndex,1)&&!mapIndices.has(m.campaignIndex),`${l}: invalid/duplicate campaign index ${m.campaignIndex}`);mapIndices.add(m.campaignIndex);
      const baseIndex=baseMaps.indexOf(m.id);
      if(baseIndex>=0)check(m.campaignIndex===baseIndex+1&&m.difficulty===Math.floor(baseIndex/5)+1,`${l}: wrong base index/group`);
      check(['garden','foundry','estuary'].includes(m.theme)&&integer(m.difficulty,1,4)&&finite(m.pathWidth,Number.MIN_VALUE)&&m.lanes.length>0,`${l}: invalid difficulty/path`);
      check(['easy','normal','hard','extreme'].includes(m.recommendedDifficulty),`${l}: invalid recommended difficulty`);
      for(const [i,lane] of m.lanes.entries()){
        check(lane.length>=2&&lane.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),`${l}: invalid lane ${i}`);
        for(let j=1;j<lane.length;j++)check(lane[j].x!==lane[j-1].x||lane[j].y!==lane[j-1].y,`${l}: zero length segment ${i}/${j}`);
      }
      for(const polygon of [...m.blocked,...m.water]){
        check(polygon.length>=3&&polygon.every(p=>validPoint(p)&&p.x<=1280&&p.y<=720),`${l}: invalid polygon`);
        const area=polygon.reduce((a,p,i)=>{const q=polygon[(i+1)%polygon.length];return a+p.x*q.y-q.x*p.y;},0);
        check(Math.abs(area)>0,`${l}: zero area polygon`);
      }
      check(assetKey(m.background,`art/maps/${m.id}`)===`art/maps/${m.id}/background.svg`,`${l}: expected background.svg`);
    }
    for(const e of config.enemies){
      const l=`enemy/${e.id}`;
      check(['orb','diamond','hex','shard','crown'].includes(e.shape)&&finite(e.hp,Number.MIN_VALUE)&&finite(e.speed,Number.MIN_VALUE)&&integer(e.bounty)&&integer(e.leak,1)&&finite(e.radius,Number.MIN_VALUE),`${l}: invalid base`);
      for(const k of ['armor','shield','regen'] as const)check(finite(e[k]),`${l}: invalid ${k}`);
      check(e.layers.length>0,`${l}: missing layers`);
      for(const layer of e.layers)check(finite(layer.hp,Number.MIN_VALUE)&&integer(layer.cash)&&textOK(layer.color),`${l}: invalid layer`);
      check(Math.abs(e.layers.reduce((a,b)=>a+b.hp,0)-e.hp)<1e-8,`${l}: layer HP sum differs`);
      check(e.layers.reduce((a,b)=>a+b.cash,0)===e.bounty,`${l}: layer cash sum differs`);
      for(const [k,v] of Object.entries(e.resist))check(elements.includes(k)&&finite(v,0,.8),`${l}: invalid resistance ${k}`);
      for(const c of e.children)check(enemies.has(c.id)&&integer(c.count,1),`${l}: invalid child ${c.id}`);
      if(bosses.includes(e.id))check(!!e.boss,`${l}: missing boss metadata`);
      if(e.boss){check(!e.cloaked&&!e.flying&&finite(e.boss.controlFactor,.15,1),`${l}: invalid boss metadata`);let prev=1;for(const p of e.boss.phases){check(finite(p.atHealth,0,1)&&p.atHealth<prev&&finite(p.shield)&&finite(p.speedMul,Number.MIN_VALUE)&&integer(p.count)&&finite(p.interval),`${l}: invalid phase`);if(p.spawn)check(enemies.has(p.spawn),`${l}: unknown phase enemy ${p.spawn}`);prev=p.atHealth;}}
    }
    graph(config.enemies,e=>e.children.map(c=>c.id),'enemy children');
    function checkWave(w:WaveDef,label:string,laneCount?:number){
      check(integer(w.number,1)&&integer(w.reward)&&textOK(w.preview),`${label}: invalid wave metadata`);
      if(w.boss)check(config.enemies.some(e=>e.id===w.boss&&e.boss),`${label}: unknown boss ${w.boss}`);
      for(const g of w.groups){check(enemies.has(g.enemy),`${label}: unknown enemy ${g.enemy}`);check(integer(g.count,1)&&finite(g.at)&&finite(g.every)&&integer(g.lane,0,laneCount===undefined?Number.MAX_SAFE_INTEGER:laneCount-1),`${label}: invalid spawn group`);check((g.hpMul===undefined||finite(g.hpMul,Number.MIN_VALUE))&&(g.speedMul===undefined||finite(g.speedMul,Number.MIN_VALUE)),`${label}: invalid spawn multiplier`);}
    }
    const waveNumbers=new Set<number>();
    for(const w of config.waves){check(!waveNumbers.has(w.number),`Duplicate wave ${w.number}`);waveNumbers.add(w.number);checkWave(w,`wave/${w.number}`);}
    for(let n=1;n<=100;n++)check(waveNumbers.has(n),`Missing wave ${n}`);
    for(const [i,n] of [10,20,40,60,80,100].entries())check(config.waves.find(w=>w.number===n)?.boss===bosses[i],`wave/${n}: wrong boss`);
    for(const m of config.maps)for(const [n,o] of Object.entries(m.waveOverrides)){
      const w=config.waves.find(w=>w.number===Number(n));check(!!w,`map/${m.id}: unknown override wave ${n}`);if(w){check(o.number===undefined||o.number===w.number,`map/${m.id}: override changes wave number`);checkWave({...w,...o},`map/${m.id}/wave/${n}`,o.groups?m.lanes.length:undefined);}
    }
    graph(config.campaign,n=>n.prerequisites,'campaign');
    const campaignMaps=new Set<string>(), unlocked=new Set<string>(INITIAL_TOWERS);
    for(const n of config.campaign){check(maps.has(n.mapId),`campaign/${n.id}: unknown map ${n.mapId}`);check(!campaignMaps.has(n.mapId),`campaign: duplicate map ${n.mapId}`);campaignMaps.add(n.mapId);unique(n.unlocks,v=>v,`campaign/${n.id}/unlocks`);for(const t of n.unlocks){check(towers.has(t),`campaign/${n.id}: unknown tower ${t}`);unlocked.add(t);}for(const p of n.prerequisites)check(nodeIds.has(p),`campaign/${n.id}: unknown prerequisite ${p}`);}
    for(const m of config.maps)check(campaignMaps.has(m.id),`campaign: missing map ${m.id}`);
    for(const t of towers)check(unlocked.has(t),`campaign: tower never unlocks ${t}`);
    for(let i=0;i<baseMaps.length;i++){
      const node=config.campaign.find(n=>n.mapId===baseMaps[i]);const prev=config.campaign.find(n=>n.mapId===baseMaps[i-1]);
      if(node)check(i===0?node.prerequisites.length===0:!!prev&&node.prerequisites.includes(prev.id),`campaign/${node.id}: missing sequential prerequisite`);
    }
    graph(config.knowledge,k=>k.requires,'knowledge');
    for(const branch of branches){const list=config.knowledge.filter(k=>k.branch===branch);const indices=new Set<number>();for(const k of list){check(integer(k.index,1)&&!indices.has(k.index),`knowledge/${k.id}: invalid/duplicate index`);indices.add(k.index);if(k.index>1){const prev=list.find(p=>p.index===k.index-1);check(!!prev&&k.requires.includes(prev.id),`knowledge/${k.id}: missing previous node`);}}for(let n=1;n<=30;n++)check(indices.has(n),`knowledge/${branch}: missing node ${n}`);}
    for(const k of config.knowledge){check(branches.includes(k.branch)&&integer(k.minLevel,1)&&k.pointCost===1&&integer(k.sealCost,1)&&textOK(k.name)&&textOK(k.description)&&k.effects.length>0,`knowledge/${k.id}: invalid node`);for(const dep of k.requires)check(knowledge.has(dep),`knowledge/${k.id}: unknown prerequisite ${dep}`);for(const e of k.effects){check(stats.includes(e.stat)&&finite(e.value,Number.MIN_VALUE),`knowledge/${k.id}: invalid effect ${e.stat}`);for(const t of e.towers??[])check(towers.has(t),`knowledge/${k.id}: unknown tower ${t}`);}}
    const difficulties=unique(config.difficulties,d=>d.id,'difficulty');requireIDs(difficulties,['easy','normal','hard','extreme'],'difficulty');
    for(const d of config.difficulties)check(integer(d.rounds,1)&&integer(d.lives,1)&&integer(d.startCredits,1)&&finite(d.towerCostMul,Number.MIN_VALUE)&&finite(d.enemyHpMul,Number.MIN_VALUE)&&finite(d.rewardMul,Number.MIN_VALUE),`difficulty/${d.id}: invalid values`);
    for(const m of modeIds)check(finite(config.economy.modeReward[m],Number.MIN_VALUE),`economy: missing mode reward ${m}`);
    for(const k of resourceKeys(config))check(Object.hasOwn(hashes,k)&&/^[0-9a-f]{64}$/.test(hashes[k]),`Missing/invalid resource: ${k}`);
    const {endlessWave:_fn,...data}=config;canonical(data);
    for(const [key,value] of Object.entries(config.economy)) if(typeof value==='number')check(finite(value),`economy: invalid ${key}`);
    if(config.contentDigest)check(config.contentDigest===contentDigest(config,hashes),'Content digest mismatch');
  }catch(error){errors.push(`Invalid catalog structure: ${error instanceof Error?error.message:String(error)}`);}
  return errors;
}

interface Factories {
  towers:readonly (()=>TowerDef)[];maps:readonly (()=>MapDef)[];knowledge:readonly (()=>KnowledgeNode[])[];
  enemies:()=>EnemyDef[];bosses:()=>EnemyDef[];waves:()=>WaveDef[];
  modes:typeof getModes;campaign:typeof getCampaign;economy:typeof getEconomy;difficulties:typeof getDifficulties;
  endless:typeof getEndlessWave;
}
export function assembleContent(f:Factories,hashes:Readonly<Record<string,string>>,version=CONTENT_VERSION):GameConfig {
  const copy=<T>(value:T):T=>structuredClone(value);
  const config:GameConfig={version:1,towers:byId(copy(f.towers.map(fn=>fn()))),maps:copy(f.maps.map(fn=>fn())).sort((a,b)=>a.campaignIndex-b.campaignIndex),knowledge:byId(copy(f.knowledge.flatMap(fn=>fn()))),enemies:byId(copy([...f.enemies(),...f.bosses()])),waves:copy(f.waves()).sort((a,b)=>a.number-b.number),modes:byId(copy(f.modes())),campaign:copy(f.campaign()),economy:copy(f.economy()),difficulties:copy(f.difficulties()),contentVersion:version,contentDigest:'',knowledgeDiscount:0,startCredits:START_CREDITS,startLives:START_LIVES,sellRatio:0.7};
  const errors=validateContent(config,hashes);
  if(errors.length)throw new Error(`Invalid content catalog:\n${errors.join('\n')}`);
  config.contentDigest=contentDigest(config,hashes);
  config.endlessWave=(wave,seed)=>f.endless(wave,seed,config.enemies);
  return config;
}
export function loadContent():GameConfig {
  return assembleContent({towers:towerFactories,maps:mapFactories,knowledge:knowledgeFactories,enemies:getEnemies,bosses:getBosses,waves:getWaves,modes:getModes,campaign:getCampaign,economy:getEconomy,difficulties:getDifficulties,endless:getEndlessWave},resourceHashes);
}
