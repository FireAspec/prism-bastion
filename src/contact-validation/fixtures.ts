import type { AttackDef, AttackMode, EnemyDef, EnemyState, GameConfig, GameState, TowerDef, Vec } from '../contracts/index';
import { attack, frame, auditTrace, type Trace } from './index';
import type { CombatModule } from '../contracts/index';
export const modes:AttackMode[]=['shot','cone','beam','chain','splash','ring','mortar','mine','drone','pulse','tide','melee'];
export interface Case { name:string; attack:AttackDef; positions:Vec[]; ticks:number; expected:string[]; noDamageBefore?:number; move?:Record<number,Vec[]>; shield?:number; damage?:number; removeAt?:number; resetHpAt?:number; expectedCredits?:number; expectedLayers?:number[] }
const near={x:160,y:100},far={x:550,y:500};
export const cases:Case[]=[
 ...modes.flatMap(mode=>[true,false].map(hit=>({name:`${mode}-${hit?'hit':'miss'}`,attack:attack({mode,splash:['splash','mortar','mine'].includes(mode)?50:0,chains:mode==='chain'?2:0}),positions:[hit?near:far],ticks:90,expected:hit?['e0']:[],...(['beam','chain'].includes(mode)&&hit?{ticks:1}:{}),...(mode==='melee'&&hit?{noDamageBefore:8}:{}),...(mode==='shot'&&hit?{noDamageBefore:5}:{})}))),
 {name:'fast-tunneling',attack:attack({projectileSpeed:12000}),positions:[{x:220,y:100}],ticks:4,expected:['e0']},
 {name:'slow-no-early-hit',attack:attack({projectileSpeed:60}),positions:[near],ticks:80,expected:['e0'],noDamageBefore:49},
 {name:'transverse-escape',attack:attack({projectileSpeed:120}),positions:[near],move:{2:[{x:160,y:160}]},ticks:90,expected:[]},
 {name:'turn-into-path',attack:attack({projectileSpeed:600}),positions:[near,{x:145,y:150}],move:{2:[{x:160,y:170},{x:145,y:100}]},ticks:30,expected:['e1']},
 {name:'melee-leaves-range',attack:attack({mode:'melee',windup:.25}),positions:[near],move:{2:[far]},ticks:40,expected:[]},
 {name:'melee-leaves-arc',attack:attack({mode:'melee',windup:.25}),positions:[near],move:{2:[{x:100,y:160}]},ticks:40,expected:[]},
 {name:'dead-target',attack:attack({projectileSpeed:120}),positions:[near],removeAt:2,ticks:60,expected:[]},
 {name:'pierce-overlap',attack:attack({pierce:2,projectileSpeed:12000}),positions:[near,{x:164,y:100},{x:200,y:100}],ticks:8,expected:['e0','e1']},
 {name:'splash-radius',attack:attack({mode:'splash',splash:30}),positions:[near,{x:165,y:110},{x:160,y:165}],ticks:60,expected:['e0','e1']},
 {name:'shield-and-layers',attack:attack({damage:90}),positions:[near],ticks:60,expected:['e0'],shield:20,expectedCredits:5,expectedLayers:[0,1]},
 {name:'shield-only',attack:attack({damage:10}),positions:[near],ticks:30,expected:['e0'],shield:20,expectedCredits:0,expectedLayers:[]},
 {name:'layer-regrow-no-double-pay',attack:attack({damage:40,interval:.5}),positions:[near],ticks:50,expected:['e0'],resetHpAt:20,expectedCredits:2,expectedLayers:[0]},
];
export function fixture(c:Case):{config:GameConfig;state:GameState} {
 const visual={asset:'base.svg',accent:'#ffffff',muzzle:'test',projectile:'test',impact:'test',scale:1,glow:0,motion:'none' as const};
 const path={id:'a',name:'A',description:'',upgrades:[]};
 const tower:TowerDef={id:'fixture',name:'Fixture',description:'',category:'weapon',cost:1,footprint:5,placement:'either',attack:c.attack,effects:[],abilities:[],visual,paths:[path,{...path,id:'b'},{...path,id:'c'}]};
 const def:EnemyDef={id:'target',name:'Target',description:'',color:'#ff8866',shape:'orb',hp:100,speed:0,bounty:10,leak:1,radius:8,armor:0,shield:c.shield??0,regen:0,cloaked:false,flying:false,resist:{},children:[],layers:[{hp:30,cash:2,color:'#fff'},{hp:30,cash:3,color:'#aaa'},{hp:40,cash:5,color:'#555'}]};
 const enemies:EnemyState[]=c.positions.map((pos,i)=>({id:`e${i}`,defId:def.id,lane:i,progress:0,pos:{...pos},hp:def.hp,maxHp:def.hp,shield:def.shield,maxShield:def.shield,statuses:[],memory:{speedMul:1},bountyPaid:false,generation:0,paidLayers:[]}));
 const options={mapId:'fixture',difficulty:'normal' as const,seed:87,endless:false,modeId:'standard',unlockedTowers:[tower.id],players:[{id:'p',name:'P',color:'#fff',connected:true}],runId:c.name,knowledge:[]};
 const rules={incomeMul:1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1,sellAllowed:true,maxLives:150,allowAbilities:true,allowPassiveIncome:true,maxTowers:60,maxTier:5,weather:'none' as const,allowKnowledge:true,rounds:60,roundRewardBase:80,roundRewardStep:4,popCashMul:1};
 const config:GameConfig={version:1,towers:[tower],enemies:[def],waves:[{number:1,groups:[],reward:84,preview:''}],maps:[{id:'fixture',name:'Fixture',description:'',difficulty:1,campaignIndex:0,recommendedDifficulty:'normal',waveOverrides:{},lanes:c.positions.map(p=>[p,{x:1270,y:p.y}]),pathWidth:1,blocked:[],water:[],theme:'garden',background:''}],modes:[{id:'standard',name:'Standard',description:'',modifiers:{},requiresClear:false}],campaign:[],contentVersion:'contact-fixture',contentDigest:'contact-fixture',knowledge:[],economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,mapXP:[250,400,600,900],mapSeals:[80,120,180,260],modeReward:{standard:1},firstClearXP:1.5,repeatXP:.65,repeatSeals:.35,defeatXP:.35,respecCost:200},difficulties:[{id:'normal',name:'Normal',rounds:60,lives:150,startCredits:900,towerCostMul:1,enemyHpMul:1,roundRewardBase:80,roundRewardStep:4,popCashMul:1,rewardMul:1}],knowledgeDiscount:0,startCredits:900,startLives:150,sellRatio:.7};
 const state:GameState={version:1,options,phase:'wave',time:0,rules,tick:0,rng:87,nextEntity:100,nextEvent:1,credits:0,lives:150,wave:1,waveTime:0,spawnCursor:[],paused:false,speed:1,autoStart:false,towers:[{id:'t0',defId:tower.id,owner:'p',pos:{x:100,y:100},tiers:[0,0,0],targeting:'near',invested:1,cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0}],enemies,events:[],projectiles:[],strikes:[],stats:{spent:0,earned:0,kills:0,damage:0,leaks:0,abilities:0,cashSubunits:0}};
 return {config,state};
}
export function runCase(c:Case,combat:CombatModule):Trace {
 const {config,state}=fixture(c), trace:Trace={version:1,name:c.name,origin:'combat',frames:[frame(state)],radii:{target:8},findings:[]};
 const damaged=new Set<string>();
 for(let tick=1;tick<=c.ticks;tick++) {
  if(c.move?.[tick])c.move[tick].forEach((pos,i)=>{if(state.enemies[i])state.enemies[i].pos={...pos};});
  if(c.removeAt===tick){state.enemies=state.enemies.filter(e=>e.id!=='e0');trace.frames.push({...frame(state),external:true});}
  if(c.resetHpAt===tick){state.enemies.forEach(e=>e.hp=e.maxHp);trace.frames.push({...frame(state),external:true});}
  const before=structuredClone(state.enemies);
  // Record externally prescribed positions at the previous boundary; no alternate combat implementation.
  if(c.move?.[tick])trace.frames.push({...frame(state),external:true});
  state.tick=tick;state.time=tick/60;state.waveTime=state.time;state.events=[];
  combat.step(state,config,1/60);
  for(const e of before){const after=state.enemies.find(x=>x.id===e.id);if(!after||after.hp<e.hp||after.shield<e.shield){damaged.add(e.id);if(tick<(c.noDamageBefore??0))trace.findings.push(`early damage at ${tick} on ${e.id}`);}}
  trace.frames.push(frame(state));state.events=[];
 }
 const actual=[...damaged].sort().join(','),expected=[...c.expected].sort().join(',');
 if(actual!==expected)trace.findings.push(`damaged [${actual}], expected [${expected}]`);
 if(c.expectedCredits!==undefined&&state.credits!==c.expectedCredits)trace.findings.push(`credits ${state.credits}, expected ${c.expectedCredits}`);
 if(c.expectedLayers&&JSON.stringify([...state.enemies[0]?.paidLayers??[]].sort())!==JSON.stringify(c.expectedLayers))trace.findings.push('incorrect paidLayers');
 if(c.removeAt!==undefined&&state.credits!==0)trace.findings.push('credits for externally removed target');
 // Removal by fixture is not a combat event; omit the boundary comparison only for this prescribed removal.
 trace.findings.push(...auditTrace(trace,config));return trace;
}
