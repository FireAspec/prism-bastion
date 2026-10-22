import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import type {AttackDef, EffectDef, ResolvedTower, Tiers, TowerDef, VisualState} from '../../src/contracts';
import {getTower} from '../../src/content/towers/orchard';

const folder = resolve(process.cwd(), 'public/art/towers/orchard');
const prices = [[335,665,1665,3990,9975],[350,700,1750,4200,10500],
  [390,775,1930,4625,11555]];

// An isolated fixture of the frozen contract's resolution order. No unfinished
// combat/engine modules are imported into this content test.
function fixtureResolve(def: TowerDef, tiers: Tiers): ResolvedTower {
  const active = tiers.flatMap((tier, i) => tier ? [i] : []);
  if (active.length > 2 || tiers.filter(t => t > 2).length > 1 ||
      tiers.some(t => !Number.isInteger(t) || t < 0 || t > 5)) throw new Error('Illegal tiers');
  const main = active.find(i => tiers[i] > 2) ?? active[0];
  const attack: AttackDef = structuredClone(def.attack);
  const effects = new Map(def.effects.map(e => [e.id, structuredClone(e)]));
  const abilities = new Map(def.abilities.map(a => [a.id, structuredClone(a)]));
  let visual: VisualState = structuredClone(def.visual);
  if (main !== undefined) {
    const mainUpgrades = def.paths[main].upgrades.slice(0,tiers[main]);
    for (const upgrade of [...mainUpgrades].reverse()) {
      if (upgrade.replaceAttack) {
        Object.assign(attack, structuredClone(upgrade.replaceAttack));
        break;
      }
    }
    visual = structuredClone(mainUpgrades.at(-1)!.visual);
  }
  for (let i=0; i<3; i++) for (const u of def.paths[i].upgrades.slice(0,tiers[i])) {
    if (u.delta.damageMul !== undefined) attack.damage *= u.delta.damageMul;
    if (u.delta.intervalMul !== undefined) attack.interval *= u.delta.intervalMul;
    if (u.delta.rangeMul !== undefined) attack.range *= u.delta.rangeMul;
    for (const e of u.effects ?? []) effects.set(e.id,structuredClone(e));
    for (const a of u.abilities ?? []) abilities.set(a.id,structuredClone(a));
  }
  const secondary = active.find(i => i !== main);
  return {
    attack, effects: [...effects.values()], abilities: [...abilities.values()],visual,
    ...(main === undefined ? {} : {mainPath: main as 0|1|2}),
    ...(secondary === undefined ? {} : {
      secondaryOverlay: `/art/towers/orchard/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`,
    }),
  };
}

const value = (effects: EffectDef[], id: string) => effects.find(e => e.id === id)?.power;

describe('Orchard content', () => {
  it('provides a useful, immutable-by-copy economy base without active damage', () => {
    const a = getTower();
    const b = getTower();
    expect({id:a.id,category:a.category,placement:a.placement,cost:a.cost,footprint:a.footprint})
      .toEqual({id:'orchard',category:'economy',placement:'land',cost:700,footprint:25});
    expect([a.attack.damage,a.attack.interval,a.attack.range]).toEqual([0,1,0]);
    expect(value(a.effects,'orchard-fruit')).toBe(30);
    a.effects[0].power = -500;
    a.paths[0].upgrades[0].name = 'mutated';
    expect(value(b.effects,'orchard-fruit')).toBe(30);
    expect(b.paths[0].upgrades[0].name).toBe('Золотые почки');
  });

  it('has precisely 3 sequential 5-tier paths, fixed prices and unique identifiers', () => {
    const def = getTower();
    expect(def.paths).toHaveLength(3);
    const ids = new Set<string>();
    for (let p=0; p<3; p++) {
      const upgrades = def.paths[p].upgrades;
      expect(upgrades).toHaveLength(5);
      expect(upgrades.map(u => u.cost)).toEqual(prices[p]);
      for (let t=0; t<5; t++) {
        const u = upgrades[t];
        expect(u.tier).toBe(t+1);
        expect(u.id).toBe(`orchard-${'abc'[p]}${t+1}`);
        expect(u.name.length).toBeGreaterThan(8);
        expect(u.description.length).toBeGreaterThan(40);
        expect(u.cost).toBeGreaterThan(0);
        expect(ids.has(u.id)).toBe(false);
        ids.add(u.id);
        if(t<2) expect(u.replaceAttack).toBeUndefined();
        else if (p!==0) expect(u.replaceAttack).toBeDefined();
        for (const e of u.effects ?? []) {
          for (const k of ['power','radius','duration','cap','interval'] as const)
            expect(Number.isFinite(e[k])).toBe(true);
          expect(e.power).toBeGreaterThan(0);
          if (e.kind==='aura' && e.stat==='attackSpeed') expect(e.power).toBeLessThanOrEqual(.5);
          if (e.kind==='aura' && e.stat==='damage') expect(e.power).toBeLessThanOrEqual(.4);
          if (e.kind==='harvest') expect(e.cap).toBeGreaterThan(0);
        }
        for (const a of u.abilities ?? []) {
          for(const n of ['power','radius','duration','cooldown'] as const)
            expect(Number.isFinite(a[n])).toBe(true);
          expect(a.cooldown).toBeGreaterThan(0);
        }
      }
    }
    expect(ids.size).toBe(15);
  });

  it('resolves every legal tier triple, including mixed cross-effects and visual paths', () => {
    const def = getTower();
    let checked=0;
    for(let a=0;a<=5;a++) for(let b=0;b<=5;b++) for(let c=0;c<=5;c++) {
      const tiers: Tiers = [a,b,c];
      if (tiers.filter(Boolean).length>2 || tiers.filter(t=>t>2).length>1) continue;
      const resolved = fixtureResolve(def,tiers);
      checked++;
      const effects = new Set(resolved.effects.map(e=>e.id));
      const abilities = new Set(resolved.abilities.map(ab=>ab.id));
      expect(effects.size).toBe(resolved.effects.length);
      expect(abilities.size).toBe(resolved.abilities.length);
      expect(Number.isFinite(resolved.attack.damage)).toBe(true);
      expect(resolved.attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(resolved.effects.every(e=>Number.isFinite(e.power))).toBe(true);
      expect(existsSync(resolve(process.cwd(),'public'+resolved.visual.asset))).toBe(true);
      if (resolved.secondaryOverlay)
        expect(existsSync(resolve(process.cwd(),'public'+resolved.secondaryOverlay))).toBe(true);
    }
    expect(checked).toBe(64);
    expect(() => fixtureResolve(def,[3,3,0])).toThrow('Illegal tiers');
    expect(() => fixtureResolve(def,[1,1,1])).toThrow('Illegal tiers');
  });

  it('maintains each of the six final 5-2-0 cross-specializations', () => {
    const def = getTower();
    const combos: Array<{tiers:Tiers;damage:number;income:number;tempo?:number;trap?:number;overlay:string}> = [
      {tiers:[5,2,0],damage:0,income:1450,tempo:.13,overlay:'b2'},
      {tiers:[5,0,2],damage:0,income:1450,trap:19,overlay:'c2'},
      {tiers:[2,5,0],damage:60,income:140,tempo:.42,overlay:'a2'},
      {tiers:[0,5,2],damage:60,income:30,tempo:.42,trap:19,overlay:'c2'},
      {tiers:[2,0,5],damage:220,income:140,trap:65,overlay:'a2'},
      {tiers:[0,2,5],damage:220,income:30,tempo:.13,trap:65,overlay:'b2'},
    ];
    for (const c of combos) {
      const resolved = fixtureResolve(def,c.tiers);
      expect(resolved.attack.damage).toBe(c.damage);
      expect(value(resolved.effects,'orchard-fruit')).toBe(c.income);
      if(c.tempo!==undefined) expect(value(resolved.effects,'orchard-tempo')).toBe(c.tempo);
      if(c.trap!==undefined) expect(value(resolved.effects,'orchard-thorns')).toBe(c.trap);
      expect(resolved.secondaryOverlay).toContain(c.overlay+'-overlay.svg');
      expect(resolved.visual.asset).toContain('abc'[resolved.mainPath!]+ '5.svg');
    }
    const thorn = fixtureResolve(def,[2,0,5]);
    expect(value(thorn.effects,'orchard-rosehip')).toBe(150);
    expect(thorn.abilities.map(a=>a.kind)).toContain('nova');
    const energy = fixtureResolve(def,[0,5,2]);
    expect(energy.abilities.map(a=>a.kind)).toContain('overclock');
  });

  it('has 16 distinct safe full-body SVGs, six overlays, and a complete local preview', () => {
    const names = ['base', ...'abc'.split('').flatMap(p=>[1,2,3,4,5].map(t=>p+t))];
    const overlays = 'abc'.split('').flatMap(p=>[1,2].map(t=>`${p}${t}-overlay`));
    expect(names).toHaveLength(16);
    expect(overlays).toHaveLength(6);
    const drawings = new Set<string>();
    for(const name of [...names,...overlays]) {
      const file = resolve(folder,`${name}.svg`);
      expect(existsSync(file)).toBe(true);
      const s = readFileSync(file,'utf8');
      expect(s).toMatch(/^<svg[^>]+viewBox="0 0 128 128"/);
      expect(s).toContain('</svg>');
      expect(s).toMatch(/<(path|ellipse|circle|polygon)/);
      expect(s).not.toMatch(/<(script|foreignObject|image|text)\b|\b(?:href|url)\s*=\s*["']https?:/i);
      expect(s).not.toMatch(/url\(['"]?https?:/i);
      if(names.includes(name)) expect(drawings.has(s)).toBe(false);
      drawings.add(s);
    }
    const preview = readFileSync(resolve(folder,'preview.html'),'utf8');
    for(const name of [...names,...overlays]) expect(preview).toContain(`${name}.svg`);
    expect(preview).not.toMatch(/<script\b|https?:\/\//i);
  });
});
