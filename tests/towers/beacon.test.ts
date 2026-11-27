import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {legalTiers} from '../../src/contracts/rules';
import type {AttackDef, EffectDef, Tiers, TowerDef, GameConfig, GameState, TowerState, EnemyDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/beacon';
import {createCombat} from '../../src/combat';
import {spawnEnemy} from '../../src/contracts/runtime';

const assets = resolve(process.cwd(),'public/art/towers/beacon');

// Independent contract fixture while the separately owned combat module is pending.
// It only resolves data; it intentionally does not claim to simulate runtime aura targeting.
function fixtureResolve(def:TowerDef, tiers:Tiers) {
  if(!legalTiers(tiers)) throw new Error('Illegal tiers');
  const effects = new Map<string,EffectDef>(def.effects.map(e=>[e.id,e]));
  const abilities = new Map(def.abilities.map(a=>[a.id,a]));
  let attack:AttackDef = structuredClone(def.attack);
  const highest = Math.max(...tiers);
  const main = highest===0 ? -1 : tiers.indexOf(highest);
  for(const [p,path] of def.paths.entries()) {
    for(const u of path.upgrades.slice(0,tiers[p])) {
      for(const e of u.effects??[]) effects.set(e.id,e);
      for(const a of u.abilities??[]) abilities.set(a.id,a);
      if(p===main && u.replaceAttack) attack=structuredClone(u.replaceAttack);
    }
  }
  const secondary=tiers.findIndex((tier,p)=>p!==main && tier>0);
  const overlay=secondary<0?undefined:
    `/art/towers/beacon/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`;
  const visual=main<0?def.visual:def.paths[main].upgrades[tiers[main]-1].visual;
  return {attack,effects:[...effects.values()],abilities:[...abilities.values()],main,overlay,visual};
}

function effect(tiers:Tiers,stat:NonNullable<EffectDef['stat']>) {
  return fixtureResolve(getTower(),tiers).effects.find(e=>e.stat===stat);
}

describe('beacon: frozen contract, purchases and support',()=>{
  it('is a useful non-damaging support at placement',()=>{
    const t=getTower();
    expect([t.id,t.category,t.placement,t.cost,t.footprint]).toEqual(['beacon','support','land',600,26]);
    expect(t.attack).toMatchObject({damage:0,interval:1,range:160});
    expect(effect([0,0,0],'damage')).toMatchObject({power:0.04,radius:160,kind:'aura'});
  });

  it('contains exactly three ordered five-step purchases and independent clones',()=>{
    const t=getTower();
    expect(t.paths.map(p=>p.upgrades.map(u=>u.cost))).toEqual([
      [300,600,1500,3600,9000],
      [300,600,1500,3600,9000],
      [285,570,1425,3420,8550],
    ]);
    expect(t.paths.map(p=>p.upgrades.map(u=>u.tier))).toEqual([
      [1,2,3,4,5],[1,2,3,4,5],[1,2,3,4,5],
    ]);
    const ids=t.paths.flatMap(p=>p.upgrades.map(u=>u.id));
    expect(new Set(ids).size).toBe(15);
    expect(t.paths.flatMap(p=>p.upgrades).every(u=>u.name.length>8 && u.description.length>48 && u.cost>0)).toBe(true);
    t.effects[0].power=999;
    t.paths[0].upgrades[4].effects![0].power=999;
    expect(getTower().effects[0].power).toBe(0.04);
    expect(getTower().paths[0].upgrades[4].effects![0].power).toBe(0.4);
  });

  it('grants useful different cross-effects at tiers one and two',()=>{
    expect(effect([1,0,0],'armorPierce')?.power).toBe(1);
    expect(effect([2,0,0],'damage')?.power).toBe(0.08);
    expect(effect([0,1,0],'detect')?.power).toBe(1);
    expect(effect([0,2,0],'range')?.power).toBe(0.06);
    expect(effect([0,0,1],'attackSpeed')?.power).toBe(0.06);
    expect(effect([0,0,2],'discount')?.power).toBe(0.03);
  });

  it('resolves every legal matrix entry with finite effects, bounded bonuses and no hidden income',()=>{
    const def=getTower();
    let count=0;
    for(let a=0;a<=5;a++) for(let b=0;b<=5;b++) for(let c=0;c<=5;c++) {
      const tiers:Tiers=[a,b,c];
      if(!legalTiers(tiers)) continue;
      count++;
      const result=fixtureResolve(def,tiers);
      const highest=Math.max(...tiers);
      const main=highest===0?-1:tiers.indexOf(highest);
      expect(result.main).toBe(main);
      expect(result.visual.asset).toBe(main<0?def.visual.asset:def.paths[main].upgrades[highest-1].visual.asset);
      expect(result.effects.every(e=>e.kind==='aura')).toBe(true);
      expect(new Set(result.effects.map(e=>e.id)).size).toBe(result.effects.length);
      for(const e of result.effects){
        expect(Number.isFinite(e.power)&&Number.isFinite(e.radius)).toBe(true);
        expect(e.power).toBeGreaterThan(0);
        expect(e.radius).toBeGreaterThan(0);
        if(e.stat==='damage') expect(e.power).toBeLessThanOrEqual(0.4);
        if(e.stat==='attackSpeed') expect(e.power).toBeLessThanOrEqual(0.5);
        if(e.stat==='discount') expect(e.power).toBeLessThanOrEqual(0.15);
      }
      expect(result.attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(result.attack.damage).toBeGreaterThanOrEqual(0);
      if(Math.max(...tiers)<5) expect(result.attack.damage).toBe(0);
      for(const ability of result.abilities) {
        expect(ability.cooldown).toBeGreaterThan(0);
        expect(Number.isFinite(ability.power)).toBe(true);
      }
    }
    expect(count).toBe(64);
  });

  it('has six valid cross-specializations with intact primary combat and secondary overlays',()=>{
    const cases:[Tiers,number,string][]=[
      [[5,2,0],0,'b2'],[[5,0,2],0,'c2'],
      [[2,5,0],1,'a2'],[[0,5,2],1,'c2'],
      [[2,0,5],2,'a2'],[[0,2,5],2,'b2'],
    ];
    for(const [tiers,main,overlay] of cases){
      const resolved=fixtureResolve(getTower(),tiers);
      expect(resolved.main).toBe(main);
      expect(resolved.overlay).toBe(`/art/towers/beacon/${overlay}-overlay.svg`);
      expect(existsSync(resolve(assets,`${overlay}-overlay.svg`))).toBe(true);
      expect(resolved.effects.map(e=>e.stat)).toContain('damage');
      if(main===1) expect(resolved.attack.statuses.some(s=>s.kind==='mark')).toBe(true);
      if(main===2) expect(resolved.attack.statuses.some(s=>s.kind==='slow')).toBe(true);
      if(main===0) expect(resolved.abilities.some(a=>a.id==='beacon-command-surge')).toBe(true);
    }
  });

  it('gives T5 branch-specific behavior absent at T4',()=>{
    expect(fixtureResolve(getTower(),[4,0,0]).abilities).toEqual([]);
    expect(fixtureResolve(getTower(),[5,0,0]).abilities).toEqual([expect.objectContaining({id:'beacon-command-surge',kind:'nova',power:90,radius:250,cooldown:65,duration:0,element:'fire'})]);
    expect(fixtureResolve(getTower(),[0,4,0]).attack.damage).toBe(0);
    expect(fixtureResolve(getTower(),[0,5,0]).attack.statuses.map(s=>s.kind)).toEqual(['reveal','mark']);
    expect(fixtureResolve(getTower(),[0,0,4]).attack.damage).toBe(0);
    expect(fixtureResolve(getTower(),[0,0,5]).attack.statuses.map(s=>s.kind)).toEqual(['slow']);
  });
});

describe('beacon: vector asset completeness',()=>{
  it('provides all 16 stand-alone models and six real overlays',()=>{
    const names=['base',...['a','b','c'].flatMap(path=>[1,2,3,4,5].map(n=>`${path}${n}`))];
    expect(names).toHaveLength(16);
    const models=getTower().paths.flatMap(p=>p.upgrades.map(u=>u.visual.asset));
    expect(new Set([getTower().visual.asset,...models]).size).toBe(16);
    for(const name of [...names,...['a','b','c'].flatMap(p=>[1,2].map(n=>`${p}${n}-overlay`))]){
      const svg=readFileSync(resolve(assets,`${name}.svg`),'utf8');
      expect(svg).toMatch(/<svg\b[^>]*viewBox="0 0 128 128"/);
      expect(svg).toContain('</svg>');
      expect(svg).toMatch(/<(path|ellipse|circle|rect|polygon)\b/);
      expect(svg).not.toMatch(/<script|<text\b|<foreignObject|<image\b|\bon\w+\s*=|\bhref\s*=|url\(['"]?https?:/i);
      expect(svg.length).toBeGreaterThan(name.includes('overlay')?600:2500);
    }
    const html=readFileSync(resolve(assets,'preview.html'),'utf8');
    for(const name of names) expect(html).toContain(`src="${name}.svg"`);
    for(const name of ['a2','b2','c2']) expect(html).toContain(`src="${name}-overlay.svg"`);
    expect((html.match(/class="overlay"/g)??[]).length).toBe(6);
  });
});


// This suite runs against the shared combat implementation once it is present.
// The standalone content branch deliberately keeps the frozen combat stub.
const runtimeAvailable=existsSync(resolve(process.cwd(),'src/combat/resolve.ts'));
function runtimeFixture(tiers:Tiers){
  const beacon=getTower();
  const ally=getTower();
  ally.id='ally'; ally.category='weapon'; ally.effects=[]; ally.abilities=[];
  ally.attack={...ally.attack,mode:'beam',damage:100,interval:1,range:300};
  const enemy:EnemyDef={id:'foe',name:'Foe',description:'',color:'#fff',shape:'orb',
    hp:1000,speed:30,bounty:0,leak:1,radius:10,armor:0,shield:0,regen:0,
    cloaked:false,flying:false,resist:{},children:[],layers:[{hp:1000,cash:0,color:'#fff'}]};
  const config:GameConfig={version:1,towers:[beacon,ally],enemies:[enemy,{...enemy,id:'hidden',cloaked:true}],waves:[],
    maps:[{id:'map',name:'Map',description:'',difficulty:1,campaignIndex:1,recommendedDifficulty:'normal',
      lanes:[[{x:0,y:0},{x:1000,y:0}]],pathWidth:10,blocked:[],water:[],waveOverrides:{},theme:'garden',background:''}],
    modes:[],campaign:[],contentVersion:'1',contentDigest:'test',knowledge:[],difficulties:[],
    economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,mapXP:[250,400,600,900],
      mapSeals:[80,120,180,260],modeReward:{},firstClearXP:1.5,repeatXP:0.65,repeatSeals:0.35,defeatXP:0.35,respecCost:200},
    knowledgeDiscount:0,startCredits:900,startLives:150,sellRatio:0.7};
  const state:GameState={version:1,options:{mapId:'map',difficulty:'normal',seed:1,endless:false,modeId:'standard',
    unlockedTowers:['beacon','ally'],players:[{id:'player',name:'Player',color:'#fff',connected:true}],runId:'test',knowledge:[]},
    phase:'wave',time:0,tick:0,rng:1,nextEntity:1,nextEvent:1,credits:0,lives:150,wave:1,waveTime:0,
    spawnCursor:[],paused:false,speed:1,autoStart:false,towers:[],enemies:[],events:[],projectiles:[],strikes:[],
    rules:{incomeMul:1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1,sellAllowed:true,maxLives:150,
      allowAbilities:true,allowPassiveIncome:true,maxTowers:60,maxTier:5,weather:'none',allowKnowledge:false,
      rounds:60,roundRewardBase:80,roundRewardStep:4,popCashMul:1},
    stats:{spent:0,earned:0,kills:0,damage:0,leaks:0,abilities:0,cashSubunits:0}};
  const placed=(id:string,defId:string,x:number,t:Tiers):TowerState=>({id,defId,owner:'player',pos:{x,y:0},tiers:t,
    targeting:'first',invested:600,cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0});
  state.towers.push(placed('beacon-source','beacon',0,tiers));
  return {config,state,placed,spawn:(id:string,x:number)=>spawnEnemy(state,config,id,0,x)};
}

describe.skipIf(!runtimeAvailable)('beacon: shared combat integration',()=>{
  it('agrees with the independent fixture on all 64 legal resolutions',()=>{
    const combat=createCombat(),def=getTower();
    for(let a=0;a<=5;a++) for(let b=0;b<=5;b++) for(let c=0;c<=5;c++){
      const tiers:Tiers=[a,b,c];
      if(!legalTiers(tiers))continue;
      const expected=fixtureResolve(def,tiers),actual=combat.resolveTower(def,tiers);
      expect(actual.attack).toEqual(expected.attack);
      expect(actual.effects).toEqual(expected.effects);
      expect(actual.abilities).toEqual(expected.abilities);
      expect(actual.visual).toEqual(expected.visual);
      expect(actual.mainPath).toBe(expected.main<0?undefined:expected.main);
      expect(actual.secondaryOverlay).toBe(expected.overlay);
    }
  });

  it('boosts a nearby ally once, not the source, and ignores a distant ally',()=>{
    const combat=createCombat();
    for(const x of [160,161]){
      const {config,state,placed,spawn}=runtimeFixture([0,0,0]);
      state.towers.push(placed('ally-1','ally',x,[0,0,0]));
      const victim=spawn('foe',200);
      combat.step(state,config,1/60);
      expect(victim.hp).toBe(x===160?896:900);
      expect(state.towers[0].damageDealt).toBe(0);
    }
    const {config,state,placed,spawn}=runtimeFixture([5,0,0]);
    state.towers.push(placed('beacon-2','beacon',10,[2,0,0]),placed('ally-1','ally',100,[0,0,0]));
    const victim=spawn('foe',200);
    combat.step(state,config,1/60);
    expect(victim.hp).toBe(860);
  });

  it('A5 nova damages visible enemies within 250 once and enforces cooldown',()=>{
    const combat=createCombat(),{config,state,spawn}=runtimeFixture([5,0,0]);
    const inside=spawn('foe',250),outside=spawn('foe',251),hidden=spawn('hidden',100);
    expect(combat.activate(state,config,'beacon-source','beacon-command-surge').ok).toBe(true);
    expect([inside.hp,outside.hp,hidden.hp]).toEqual([910,1000,1000]);
    expect(combat.activate(state,config,'beacon-source','beacon-command-surge').ok).toBe(false);
    expect(inside.hp).toBe(910);
    expect(state.stats.abilities).toBe(1);
  });

  it('B5 reveals and marks hidden targets; C5 slows without self acceleration',()=>{
    const combat=createCombat();
    const watch=runtimeFixture([0,5,0]);
    const hidden=watch.spawn('hidden',100),far=watch.spawn('foe',276);
    combat.step(watch.state,watch.config,1/60);
    expect(hidden.hp).toBe(992);
    expect(hidden.statuses).toEqual(expect.arrayContaining([expect.objectContaining({kind:'reveal'}),expect.objectContaining({kind:'mark'})]));
    expect(far.hp).toBe(1000);
    const rhythm=runtimeFixture([0,0,5]);
    const foe=rhythm.spawn('foe',100);
    combat.step(rhythm.state,rhythm.config,1/60);
    expect(foe.hp).toBe(995);
    expect(foe.statuses).toEqual(expect.arrayContaining([expect.objectContaining({kind:'slow',power:0.1})]));
    expect(rhythm.state.towers[0].cooldown).toBeCloseTo(1.25,5);
  });
});
