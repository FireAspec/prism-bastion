import {test} from 'vitest';
import type {GameConfig, Profile, RunResult, TowerDef, AttackDef, KnowledgeNode, KnowledgeStat, DifficultyDef, GameState} from '../../src/contracts';
import {getEconomy} from '../../src/content/economy';
import {createProgression, medalKey, xpToLevel, canCompleteCampaign, terminalResult} from '../../src/progression';
import {caps} from '../../src/progression/knowledge';

function eq(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual)!==JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function near(actual: number, expected: number): void {
  if (Math.abs(actual-expected)>1e-8 || !Number.isFinite(actual)) throw new Error(`Expected ${expected}, got ${actual}`);
}
function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed'); }
const attack: AttackDef = {mode:'shot',element:'kinetic',damage:100,interval:1,range:100,pierce:1,count:1,splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,statuses:[{kind:'burn',power:1,duration:10},{kind:'stun',power:1,duration:10}],projectileSpeed:100,projectileRadius:2,homing:false,windup:0,arc:0};
const visual: TowerDef['visual'] = {asset:'base.svg',accent:'#fff',muzzle:'a',projectile:'b',impact:'c',scale:1,glow:0,motion:'none'};
function tower(id: string, category: TowerDef['category']): TowerDef {
  return {id,category,name:id,description:'',cost:100,footprint:10,placement:'land',attack:structuredClone(attack),visual:{...visual},effects:[{id:'a',kind:'aura',stat:'detect',power:1,radius:100,interval:1,duration:1,cap:0},{id:'b',kind:'income',power:100,radius:0,interval:1,duration:1,cap:0}],abilities:[{id:'a',name:'a',description:'',cooldown:100,kind:'nova',power:100,duration:1,radius:100,element:'kinetic'}],paths:[0,1,2].map(i=>({id:String(i),name:'',description:'',upgrades:[{id:`u${i}`,name:'',description:'',tier:1,cost:50,delta:{damageMul:2},replaceAttack:structuredClone(attack),addStatuses:[{kind:'freeze',power:1,duration:10}],visual:{...visual}}]})) as TowerDef['paths']};
}
function node(id='a', index=1, requires:string[]=[]): KnowledgeNode {
  return {id,index,requires,branch:'ballistics',minLevel:1,pointCost:1,sealCost:30,name:id,description:'',icon:'a.svg',effects:[{stat:'weaponDamage',value:.1}]};
}
function config(): GameConfig {
  const difficulties: DifficultyDef[] = (['easy','normal','hard','extreme'] as const).map((id,i)=>({id,name:id,rounds:40+20*i,lives:[200,150,100,1][i],startCredits:900,towerCostMul:1,enemyHpMul:1,roundRewardBase:80,roundRewardStep:4,popCashMul:1,rewardMul:[.7,1,1.35,1.7][i]}));
  return {version:1,towers:[tower('w','weapon'),tower('t','tech'),tower('e','element'),tower('water','water')],enemies:[],waves:[],maps:[1,2,3,4].map((d,i)=>({id:`m${d}`,difficulty:d as 1|2|3|4,campaignIndex:i,name:'',description:'',recommendedDifficulty:difficulties[i].id,waveOverrides:{},lanes:[],pathWidth:10,blocked:[],water:[],theme:'garden',background:''})),modes:[{id:'standard',name:'',description:'',requiresClear:false,modifiers:{}},{id:'iron-oath',name:'',description:'',requiresClear:true,modifiers:{allowKnowledge:false,maxLives:1,allowPassiveIncome:false}},{id:'no-leaks',name:'',description:'',requiresClear:true,modifiers:{maxLives:1}}],campaign:[],contentVersion:'1',contentDigest:'digest',knowledge:[node(),node('b',2,['a'])],economy:getEconomy(),difficulties,knowledgeDiscount:0,startCredits:900,startLives:150,sellRatio:.7,endlessWave:(wave)=>({number:wave,groups:[],preview:'',reward:0})};
}
function profile(xp=0,seals=0): Profile {
  return {version:1,settings:{master:1,music:1,sfx:1,language:'ru',fullscreen:false,quality:'high',colorblind:false,reducedMotion:false},medals:{},unlockedCosmetics:[],bestWave:{},completedRuns:0,tutorialSeen:false,completedNodes:[],unlockedTowers:[],xp,level:1,seals,knowledgePoints:0,knowledgeUnlocked:[],knowledgePaid:[],claimedRuns:[],respecCount:0};
}
function result(overrides: Partial<RunResult>={}): RunResult {
  return {runId:'r1',mapId:'m1',modeId:'standard',won:true,wave:60,rounds:60,seed:1,eligible:true,durationSeconds:100,contentDigest:'digest',difficulty:'normal',...overrides};
}
test('absolute XP boundaries and prestige',()=>{
  const c=config(), s=createProgression(c);
  eq(s.xpToNext(1),245); eq(xpToLevel(244,c.economy),1); eq(xpToLevel(245,c.economy),2);
  eq(xpToLevel(504,c.economy),2); eq(xpToLevel(545,c.economy),3);
  eq(xpToLevel(275624,c.economy),50); eq(xpToLevel(275625,c.economy),51);
  eq(s.respec(profile(1_000_000)).profile.knowledgePoints,150);
});
test('first and repeat medal; multiple level ups; duplicate after JSON import',()=>{
  const s=createProgression(config()), original=profile();
  const first=s.reward(original,result({mapId:'m4',difficulty:'extreme',wave:100,rounds:100}));
  eq(first.receipt.xp,2295); eq(first.receipt.seals,442); assert(first.receipt.points>3); eq(original.xp,0);
  const imported: Profile=JSON.parse(JSON.stringify(first.profile));
  const duplicate=s.reward(imported,result({mapId:'m4',difficulty:'extreme',wave:100,rounds:100}));
  eq(duplicate.receipt.duplicate,true); eq(duplicate.profile,imported);
  const repeated=s.reward(imported,result({runId:'r2',mapId:'m4',difficulty:'extreme',wave:100,rounds:100}));
  eq(repeated.receipt.xp,994); eq(repeated.receipt.seals,154); eq(repeated.receipt.firstClear,false);
  eq(repeated.profile.medals[medalKey(result({mapId:'m4',difficulty:'extreme'}))],2);
});
test('defeat, eligibility, bad digest, premature victory, endless and duplicate defeat',()=>{
  const s=createProgression(config()), p=profile();
  for (const r of [result({eligible:false}),result({contentDigest:'bad'}),result({wave:59}),result({wave:61}),result({won:false,wave:61})]) eq(s.reward(p,r).profile,p);
  const low=s.reward(p,result({won:false,wave:9})); eq(low.receipt.xp,0);
  const loss=s.reward(low.profile,result({runId:'loss',won:false,wave:30}));
  eq(loss.receipt.xp,43); eq(loss.receipt.seals,0); eq(loss.profile.medals,{});
  eq(s.reward(loss.profile,result({runId:'loss',won:false,wave:30})).receipt.duplicate,true);
});
test('purchase atomicity and prerequisites; three free respecs and paid history',()=>{
  const s=createProgression(config()), p=profile(245,29);
  eq(s.buy(p,'a').reason,'seals'); eq(s.buy(p,'b').reason,'prerequisites'); eq(p.seals,29);
  const bought=s.buy(profile(245,30),'a'); assert(bought.ok); eq(bought.profile.seals,0); eq(bought.profile.knowledgePoints,2);
  let q=bought.profile;
  for(let i=0;i<3;i++){const r=s.respec(q);assert(r.ok);q=r.profile;}
  eq(q.knowledgePoints,3); eq(q.knowledgePaid,['a']); eq(s.respec(q).reason,'seals');
  const again=s.buy(q,'a');assert(again.ok);eq(again.profile.seals,0);
  const paid=s.respec({...again.profile,seals:200});assert(paid.ok);eq(paid.profile.seals,0);
});
test('all 19 stats, caps, scoped bonuses, copies, untouched prices and deltas',()=>{
  const c=config(); c.knowledge[0].effects=Object.entries(caps).map(([stat,value])=>({stat:stat as KnowledgeStat,value}));
  c.knowledge[1].effects=[{stat:'weaponDamage',value:.1}];
  const before=JSON.stringify(c), s=createProgression(c), ids=s.combineKnowledge([['a','b'],['a'],['a'],['a']],'standard');eq(ids,['a','b']);
  const out=s.applyKnowledge(c,ids,'standard'), [w,t,e,water]=out.towers;
  near(w.attack.damage,115); near(t.attack.damage,115); near(e.attack.damage,115); near(water.attack.damage,115);
  near(w.attack.interval,1/1.12); near(w.attack.range,110); near(water.attack.range,110);
  near(w.attack.shieldMultiplier,1.2); near(w.attack.bossMultiplier,1.12);
  near(w.attack.statuses[0].duration,11.5); near(w.attack.statuses[1].duration,11);
  near(w.effects[0].radius,128.8); near(w.effects[1].power,115); near(w.abilities[0].cooldown,88);
  near(w.paths[0].upgrades[0].replaceAttack!.damage,115);near(w.paths[0].upgrades[0].addStatuses![0].duration,11);
  eq(out.knowledgeDiscount,.08); eq(out.difficulties[1].startCredits,990); eq(out.difficulties[1].lives,170);eq(out.difficulties[3].lives,1);
  eq(w.cost,100); eq(w.paths[0].upgrades[0].cost,50);eq(w.paths[0].upgrades[0].delta.damageMul,2);
  eq(JSON.stringify(c),before);assert(out.endlessWave===c.endlessWave);assert(out.maps!==c.maps);
  const reward=s.rewardForRun(profile(),result(),ids);eq(reward.receipt.xp,412);eq(reward.receipt.seals,88);
  const strict=s.applyKnowledge(c,ids,'iron-oath');eq(strict.knowledgeDiscount,0);eq(strict.towers[0].attack.damage,100);
  eq(s.applyKnowledge(out,ids,'standard').towers[0].attack.damage,w.attack.damage);
  eq(s.applyKnowledge(out,ids,'iron-oath').towers[0].attack.damage,100);
  eq(s.combineKnowledge([ids],'iron-oath'),[]);eq(s.rewardForRun(profile(),result({modeId:'iron-oath'}),ids).receipt.xp,843);
  eq(s.applyKnowledge(c,ids,'no-leaks').difficulties[1].lives,150);
  c.knowledge[0].effects=[{stat:'weaponDamage',value:.1,towers:['w']}];
  const scoped=s.applyKnowledge(c,['a'],'standard');near(scoped.towers[0].attack.damage,110);eq(scoped.towers[1].attack.damage,100);
});
test('catalog graph validation',()=>{
  const s=createProgression(config());eq(s.validateCatalog([node(),node('b',2,['a'])]),[]);
  assert(s.validateCatalog([node('a',1,['b']),node('b',2,['a'])]).some(e=>e.includes('Cycle')));
  assert(s.validateCatalog([node('a',1,['missing'])]).some(e=>e.includes('Missing prerequisite')));
});
test('baseline twenty first clears',()=>{
  const c=config(),s=createProgression(c);let p=profile();
  for(let i=0;i<4;i++) for(let j=0;j<5;j++) {
    // Each of five maps in a group is distinct.
    const mapId=`g${i}-${j}`;c.maps.push({...c.maps[i],id:mapId});
    p=s.reward(p,result({runId:mapId,mapId,difficulty:c.difficulties[i].id,wave:c.difficulties[i].rounds,rounds:c.difficulties[i].rounds})).profile;
  }
  eq(p.xp,21860);eq(p.seals,4305);eq(p.level,19);eq(p.knowledgePoints,54);
});

test('terminal snapshot adapter and guest story prerequisites',()=>{
  const c=config(), p=profile();
  c.campaign=[{id:'second',mapId:'m2',prerequisites:['first'],unlocks:['w'],title:'',briefing:'',outro:''}];
  const options: GameState['options']={runId:'r',mapId:'m2',modeId:'standard',difficulty:'normal',seed:1,endless:true,players:[],knowledge:[],unlockedTowers:[]};
  const rules: GameState['rules']={rounds:60,incomeMul:1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1,sellAllowed:true,maxLives:150,allowAbilities:true,allowPassiveIncome:true,maxTowers:60,maxTier:5,weather:'none',allowKnowledge:true,roundRewardBase:80,roundRewardStep:4,popCashMul:1};
  const state={phase:'wave' as GameState['phase'],options,rules,wave:20,time:120};
  eq(terminalResult(state,true,'digest'),null);
  const loss=terminalResult({...state,phase:'defeat'},true,'digest');assert(loss);eq(loss.wave,19);
  eq(terminalResult({...state,phase:'defeat',wave:61},true,'digest'),null);
  const win=terminalResult({...state,phase:'victory',wave:60},true,'digest');assert(win);
  eq(canCompleteCampaign(c,p,win),false);eq(canCompleteCampaign(c,{...p,completedNodes:['first']},win),true);
  const awarded=createProgression(c).reward(p,win);assert(awarded.receipt.xp>0);eq(awarded.profile.completedNodes,[]);
});
