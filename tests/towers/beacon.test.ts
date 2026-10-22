import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {legalTiers} from '../../src/contracts/rules';
import type {AttackDef, EffectDef, Tiers, TowerDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/beacon';

const assets = resolve(process.cwd(),'public/art/towers/beacon');

// Independent contract fixture while the separately owned combat module is pending.
// It only resolves data; it intentionally does not claim to simulate runtime aura targeting.
function fixtureResolve(def:TowerDef, tiers:Tiers) {
  if(!legalTiers(tiers)) throw new Error('Illegal tiers');
  const effects = new Map<string,EffectDef>(def.effects.map(e=>[e.id,e]));
  const abilities = new Map(def.abilities.map(a=>[a.id,a]));
  let attack:AttackDef = structuredClone(def.attack);
  let main = -1;
  const high = tiers.findIndex(t=>t>2);
  if(high>=0) main=high;
  else main=tiers.findIndex(t=>t>0);
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
  return {attack,effects:[...effects.values()],abilities:[...abilities.values()],main,overlay};
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
    expect(fixtureResolve(getTower(),[5,0,0]).abilities.map(a=>a.kind)).toEqual(['overclock']);
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
