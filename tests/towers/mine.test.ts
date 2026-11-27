import {describe, expect, it} from 'vitest';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, Tiers, TowerDef, UpgradeDef} from '../../src/contracts';
import {canUpgrade,legalTiers,sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/mine';

const assetRoot = fileURLToPath(new URL('../../public/art/towers/mine/', import.meta.url));
const pathKeys = ['a','b','c'] as const;

/** Isolated fixture resolver: mirrors the frozen public data semantics without importing the unfinished combat. */
function resolveFixture(def:TowerDef,tiers:Tiers):ResolvedTower {
  if(!legalTiers(tiers))throw new RangeError('Illegal tiers');
  const chosen:PathIndex = tiers[0]>=tiers[1]&&tiers[0]>=tiers[2]?0
    :tiers[1]>=tiers[2]?1:2;
  const current=def.paths[chosen].upgrades.slice(0,tiers[chosen]);
  const replacement=[...current].reverse().find(u=>u.replaceAttack)?.replaceAttack;
  const attack:AttackDef=structuredClone(replacement??def.attack);
  const effects=new Map<string,EffectDef>(def.effects.map(e=>[e.id,structuredClone(e)]));
  const abilities=new Map(def.abilities.map(a=>[a.id,structuredClone(a)]));
  const statusByKind=new Map(attack.statuses.map(s=>[s.kind,structuredClone(s)]));
  for(let p=0;p<3;p++)for(const u of def.paths[p].upgrades.slice(0,tiers[p])){
    for(const [key,v] of Object.entries(u.delta) as [keyof UpgradeDef['delta'],number|boolean][]) {
      if(key==='detects') {attack.detects ||= Boolean(v);continue;}
      const dest={damageMul:'damage',intervalMul:'interval',rangeMul:'range',
        pierceAdd:'pierce',countAdd:'count',splashAdd:'splash',chainsAdd:'chains',
        chainRadiusAdd:'chainRadius',armorPierceAdd:'armorPierce',
        shieldMultiplierMul:'shieldMultiplier',bossMultiplierMul:'bossMultiplier',
        executeBelowAdd:'executeBelow',pushAdd:'push',projectileSpeedMul:'projectileSpeed',
        windupMul:'windup',arcAdd:'arc'}[key];
      if(!dest)throw new Error(`Unknown delta ${key}`);
      const field=dest as keyof AttackDef;
      const currentValue=attack[field];
      if(typeof currentValue!=='number')throw new Error(`Non-numeric attack field ${field}`);
      const next=key.endsWith('Mul')?currentValue*Number(v):currentValue+Number(v);
      Object.assign(attack,{[field]:next});
    }
    for(const s of u.addStatuses??[]){
      const prev=statusByKind.get(s.kind);
      statusByKind.set(s.kind,prev?{kind:s.kind,power:Math.max(prev.power,s.power),duration:Math.max(prev.duration,s.duration),maxStacks:Math.max(prev.maxStacks??1,s.maxStacks??1)}:structuredClone(s));
    }
    for(const effect of u.effects??[])effects.set(effect.id,structuredClone(effect));
    for(const ability of u.abilities??[])abilities.set(ability.id,structuredClone(ability));
  }
  attack.statuses=[...statusByKind.values()];
  const secondary = ([0,1,2] as PathIndex[]).find(p=>p!==chosen&&tiers[p]>0);
  return {attack,effects:[...effects.values()],abilities:[...abilities.values()],
    visual:current.at(-1)?.visual??def.visual,...(tiers.some(t=>t>0)?{mainPath:chosen}:{}),
    ...(secondary===undefined?{}:{secondaryOverlay:
      `/art/towers/mine/${pathKeys[secondary]}${tiers[secondary]}-overlay.svg`})};
}

describe('mine catalog contract',()=>{
  it('has a useful distinct base with exact placement and price',()=>{
    const mine=getTower();
    expect([mine.id,mine.name,mine.category,mine.placement,mine.footprint,mine.cost])
      .toEqual(['mine','Минный узел','tech','land',25,450]);
    expect([mine.attack.mode,mine.attack.damage,mine.attack.interval,mine.attack.range])
      .toEqual(['mine',40,2.8,100]);
    expect(mine.attack.splash).toBe(0);
  });
  it('includes exactly 15 uniquely identified, ordered, positive and finite upgrades',()=>{
    const mine=getTower();
    const prices=[[225,450,1125,2700,6750],[215,430,1070,2565,6415],
      [250,500,1240,2975,7430]];
    expect(mine.paths.map(p=>p.upgrades.map(u=>u.cost))).toEqual(prices);
    const all=mine.paths.flatMap(p=>p.upgrades);
    expect(all).toHaveLength(15);
    expect(new Set(all.map(u=>u.id)).size).toBe(15);
    expect(new Set(all.map(u=>u.name)).size).toBe(15);
    for(let i=0;i<3;i++)for(let j=0;j<5;j++){
      const u=mine.paths[i].upgrades[j];
      expect(u.id).toBe(`mine-${pathKeys[i]}${j+1}`);
      expect(u.tier).toBe(j+1);
      expect(u.description.length).toBeGreaterThan(35);
      for(const value of [u.cost,...Object.values(u.delta)]){
        if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);
      }
      if(j<2)expect(u.replaceAttack).toBeUndefined();
      for(const eff of u.effects??[])for(const value of [eff.power,eff.radius,
        eff.interval,eff.duration,eff.cap])expect(Number.isFinite(value)).toBe(true);
    }
  });
  it('returns fresh deep copies without shared upgrade mutations',()=>{
    const a=getTower();const b=getTower();
    a.attack.damage=999;a.paths[0].upgrades[4].delta.countAdd=900;
    a.paths[2].upgrades[4].replaceAttack!.statuses[0].duration=900;
    expect(b.attack.damage).toBe(40);
    expect(b.paths[0].upgrades[4].delta.countAdd).toBe(2);
    expect(b.paths[2].upgrades[4].replaceAttack!.statuses[0].duration).toBe(3.5);
  });
});

describe('resolved matrix and behavioral endpoints',()=>{
  it('exhausts all 216 triples; rejects all illegal tiers and validates every legal endpoint',()=>{
    const mine=getTower();let valid=0;
    for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
      const tiers:Tiers=[a,b,c];
      if(!legalTiers(tiers)){
        expect(()=>resolveFixture(mine,tiers)).toThrow(RangeError);continue;
      }
      valid++;
      const resolved=resolveFixture(mine,tiers);
      const atk=resolved.attack;
      for(const n of [atk.damage,atk.interval,atk.range,atk.count,atk.pierce,
        atk.shieldMultiplier,atk.bossMultiplier]){
        expect(Number.isFinite(n)).toBe(true);expect(n).toBeGreaterThan(0);
      }
      expect(atk.interval).toBeGreaterThanOrEqual(.05);
      expect(atk.splash).toBe(0);
      expect(atk.armorPierce).toBeGreaterThanOrEqual(0);
      expect(resolved.visual.asset.endsWith('.svg')).toBe(true);
      if(resolved.secondaryOverlay)expect(existsSync(assetRoot+resolved.secondaryOverlay.split('/').at(-1))).toBe(true);
      for(const status of atk.statuses){expect(status.duration).toBeGreaterThan(0);expect(status.power).toBeGreaterThan(0);}
      for(const effect of resolved.effects)expect(effect.id.length).toBeGreaterThan(0);
      for(const ability of resolved.abilities)expect(ability.cooldown).toBeGreaterThan(0);
      for(const p of [0,1,2] as PathIndex[])if(canUpgrade(tiers,p)){
        const next:Tiers=[...tiers];next[p]++;
        expect(legalTiers(next)).toBe(true);
      }
    }
    expect(valid).toBe(64);
  });
  it('sets exact T5 capabilities, including field echoes, anti-armor and active stasis',()=>{
    const d=getTower();
    const a=resolveFixture(d,[5,0,0]);
    expect([a.attack.damage,a.attack.count,a.attack.interval,a.attack.splash])
      .toEqual([120,7,1.76,0]);
    expect(a.attack.range).toBeCloseTo(160*1.06*1.12*1.08*1.10);
    expect(a.effects.map(e=>e.id)).toContain('mine-echo');
    const b=resolveFixture(d,[0,5,0]);
    expect(b.attack.count).toBe(2);
    expect(b.attack.armorPierce).toBe(108);
    expect(b.attack.shieldMultiplier).toBeCloseTo(2.44375);
    expect(b.attack.statuses.map(s=>s.kind)).toContain('mark');
    expect(b.attack.statuses).toContainEqual({kind:'shred',power:12,duration:3});
    const c=resolveFixture(d,[0,0,5]);
    expect([c.attack.element,c.attack.count,c.attack.splash]).toEqual(['frost',4,0]);
    expect(c.attack.interval).toBeCloseTo(1.321488);
    expect(c.attack.statuses.find(s=>s.kind==='freeze')?.duration).toBe(.48);
    expect(c.abilities.map(a=>a.id)).toContain('mine-timebreak');
  });
  it('keeps main morphology and adds the exact secondary overlay across all six crosspaths',()=>{
    const d=getTower();
    const combinations:Tiers[]=[[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
    const expected=[['a5.svg','b2-overlay.svg'],['a5.svg','c2-overlay.svg'],
      ['b5.svg','a2-overlay.svg'],['b5.svg','c2-overlay.svg'],
      ['c5.svg','a2-overlay.svg'],['c5.svg','b2-overlay.svg']];
    combinations.forEach((tiers,i)=>{
      const r=resolveFixture(d,tiers);
      expect(r.visual.asset.split('/').at(-1)).toBe(expected[i][0]);
      expect(r.secondaryOverlay?.split('/').at(-1)).toBe(expected[i][1]);
      const invested=d.cost+tiers.reduce((sum,n,p)=>sum+
        d.paths[p].upgrades.slice(0,n).reduce((s,u)=>s+u.cost,0),0);
      expect(sellRefund(invested)).toBeLessThan(invested);
    });
    expect(resolveFixture(d,[2,2,0]).mainPath).toBe(0);
    expect(resolveFixture(d,[0,0,0]).mainPath).toBeUndefined();
    expect(resolveFixture(d,[1,1,0]).secondaryOverlay).toContain('b1-overlay.svg');
  });
  it('supplies distinct low-tier cross effects without replacing an attack',()=>{
    const d=getTower();
    const a=resolveFixture(d,[2,0,0]),b=resolveFixture(d,[0,2,0]),c=resolveFixture(d,[0,0,2]);
    expect(a.attack.count).toBe(2);
    expect(a.attack.range).toBeCloseTo(118.72);
    expect(b.attack.armorPierce).toBe(13);
    expect(b.attack.shieldMultiplier).toBeCloseTo(1.15);
    expect(c.attack.detects).toBe(true);
    expect(c.attack.statuses).toContainEqual({kind:'slow',power:.32,duration:2.2,maxStacks:1});
    expect([a.attack.mode,b.attack.mode,c.attack.mode]).toEqual(['mine','mine','mine']);
  });
});

describe('complete local SVG inventory',()=>{
  it('has 16 full model drawings and 6 fully transparent secondary overlays',()=>{
    const d=getTower();
    const files=['base.svg',...pathKeys.flatMap(p=>[1,2,3,4,5].map(t=>`${p}${t}.svg`)),
      ...pathKeys.flatMap(p=>[1,2].map(t=>`${p}${t}-overlay.svg`))];
    expect(files).toHaveLength(22);
    expect(new Set(files).size).toBe(22);
    const assets=[d.visual.asset,...d.paths.flatMap(p=>p.upgrades.map(u=>u.visual.asset))];
    expect(assets.map(a=>a.split('/').at(-1))).toEqual(files.slice(0,16));
    for(const file of files){
      const svg=readFileSync(resolve(assetRoot,file),'utf8');
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 128 128"/);
      expect(svg).toMatch(/<(circle|path|polygon|rect|ellipse|line)\b/);
      expect(svg).not.toMatch(/<(script|foreignObject|text|image)\b|<style\b/i);
      expect(svg).not.toMatch(/(?:href|src)="(?:https?:|data:|javascript:)/i);
      expect(svg).toContain('</svg>');
    }
  });
  it('includes a working HTML gallery with 16 models and all six crosspath compositions',()=>{
    const html=readFileSync(resolve(assetRoot,'preview.html'),'utf8');
    expect(html).toContain('lang="ru"');
    for(const p of pathKeys)for(let t=1;t<=5;t++)expect(html).toContain(`src="${p}${t}.svg"`);
    expect(html).toContain('src="base.svg"');
    expect((html.match(/class="cross"/g)??[])).toHaveLength(6);
    for(const p of pathKeys)for(let t=1;t<=2;t++)expect(html).toContain(`src="${p}${t}-overlay.svg"`);
  });
});
