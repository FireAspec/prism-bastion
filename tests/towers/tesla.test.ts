import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getTower} from '../../src/content/towers/tesla';
import {legalTiers, sellRefund} from '../../src/contracts/rules';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, StatusSpec, Tiers} from '../../src/contracts';

// Fixture resolver follows the frozen upgrade data rules, independent of the pending combat module.
function fixtureResolve(tiers: Tiers): ResolvedTower {
 if (!legalTiers(tiers)) throw new RangeError('Illegal upgrade combination');
 const def = getTower();
 const mainIndex = tiers.findIndex(n => n > 0 && n === Math.max(...tiers));
 const mainPath = mainIndex >= 0 ? mainIndex as PathIndex : undefined;
 const selected = def.paths.flatMap((p, i) => p.upgrades.slice(0, tiers[i]));
 const replacement = mainPath !== undefined
  ? [...def.paths[mainPath].upgrades.slice(0, tiers[mainPath])].reverse().find(u => u.replaceAttack)?.replaceAttack
  : undefined;
 const attack: AttackDef = structuredClone(replacement ?? def.attack);
 const effects: EffectDef[] = structuredClone(def.effects);
 const abilities = structuredClone(def.abilities);
 const statuses = new Map<string, StatusSpec>(attack.statuses.map(s => [s.kind, s]));
 for (const u of selected) {
  const d = u.delta;
  for (const key of ['damage', 'interval', 'range', 'projectileSpeed', 'windup'] as const) {
   const multiplier = d[`${key}Mul` as keyof typeof d];
   if (typeof multiplier === 'number') attack[key] *= multiplier;
  }
  for (const [field, key] of [
   ['pierce', 'pierceAdd'], ['count', 'countAdd'], ['splash', 'splashAdd'],
   ['chains', 'chainsAdd'], ['chainRadius', 'chainRadiusAdd'],
   ['armorPierce', 'armorPierceAdd'], ['executeBelow', 'executeBelowAdd'],
   ['push', 'pushAdd'], ['arc', 'arcAdd'],
  ] as const) {
   const add = d[key];
   if (typeof add === 'number') attack[field] += add;
  }
  for (const [field, key] of [
   ['shieldMultiplier', 'shieldMultiplierMul'], ['bossMultiplier', 'bossMultiplierMul'],
  ] as const) {
   const mul = d[key];
   if (typeof mul === 'number') attack[field] *= mul;
  }
  if (d.detects) attack.detects = true;
  for (const status of u.addStatuses ?? []) statuses.set(status.kind, status);
  for (const effect of u.effects ?? []) {
   const existing = effects.findIndex(e => e.id === effect.id);
   if (existing >= 0) effects[existing] = effect;
   else effects.push(effect);
  }
  for (const ability of u.abilities ?? []) {
   const existing = abilities.findIndex(a => a.id === ability.id);
   if (existing >= 0) abilities[existing] = ability;
   else abilities.push(ability);
  }
 }
 attack.statuses = [...statuses.values()];
 const primary = mainPath !== undefined ? def.paths[mainPath].upgrades[tiers[mainPath]-1].visual : def.visual;
 const secondary = tiers.findIndex((n,i) => n > 0 && i !== mainPath);
 const secondaryOverlay = secondary >= 0 ? `/art/towers/tesla/${'abc'[secondary]}${tiers[secondary]}-overlay.svg` : undefined;
 return {...(mainPath !== undefined ? {mainPath} : {}), attack, effects, abilities,
  visual: primary, ...(secondaryOverlay ? {secondaryOverlay} : {})};
}

const svgPath = (asset: string) => resolve(process.cwd(), 'public', asset.replace(/^\//, '').replace(/^art\//, 'art/'));

describe('tesla catalog, state space and economics', () => {
 it('has an independent complete base and exactly 15 priced, ordered improvements', () => {
  const def = getTower();
  expect([def.id,def.category,def.placement,def.cost,def.footprint]).toEqual(['tesla','element','land',800,26]);
  expect([def.attack.mode,def.attack.damage,def.attack.interval,def.attack.range]).toEqual(['chain',17,1.1,170]);
  expect(def.paths).toHaveLength(3);
  const costs = [[445,885,2205,5285,13205],[400,800,2000,4800,12000],[380,760,1900,4560,11400]];
  const ids = new Set<string>();
  def.paths.forEach((p,i) => {
   expect(p.upgrades).toHaveLength(5);
   expect(p.upgrades.map(u => u.cost)).toEqual(costs[i]);
   p.upgrades.forEach((u,j) => {
    expect(u.id).toBe(`tesla-${'abc'[i]}${j+1}`);
    expect(u.tier).toBe(j+1);
    expect(u.cost).toBeGreaterThan(0);
    expect(u.name.length).toBeGreaterThan(12);
    expect(u.description.length).toBeGreaterThan(45);
    expect(ids.has(u.id)).toBe(false);
    ids.add(u.id);
    if(j<2) expect(u.replaceAttack).toBeUndefined();
   });
  });
 });

 it('applies no mode replacement in crosspath T1/T2 and has mode changes at B3/C3', () => {
  const def = getTower();
  for (const p of def.paths) for(const u of p.upgrades.slice(0,2)) expect(u.replaceAttack).toBeUndefined();
  expect(def.paths[1].upgrades[2].replaceAttack?.mode).toBe('beam');
  expect(def.paths[2].upgrades[2].replaceAttack?.mode).toBe('ring');
  expect(def.paths[0].upgrades[2].replaceAttack).toBeUndefined();
 });

 it('resolves all 216 state combinations or rejects them exactly according to frozen tier legality', () => {
  let accepted = 0;
  for (let a=0;a<=5;a++) for(let b=0;b<=5;b++) for(let c=0;c<=5;c++) {
   const tiers:Tiers=[a,b,c];
   if (!legalTiers(tiers)) {expect(()=>fixtureResolve(tiers)).toThrow(RangeError);continue;}
   accepted++;
   const resolved = fixtureResolve(tiers);
   const expectedMain = tiers.findIndex(n => n > 0 && n === Math.max(...tiers));
   expect(resolved.mainPath).toBe(expectedMain < 0 ? undefined : expectedMain);
   if (resolved.attack.mode === 'chain' || resolved.attack.mode === 'beam') expect(resolved.attack.windup).toBe(0);
   for (const echo of resolved.effects.filter(e => e.kind === 'echo')) expect(echo.radius).toBeGreaterThan(0);
   expect(resolved.attack.damage).toBeGreaterThan(0);
   expect(resolved.attack.interval).toBeGreaterThanOrEqual(0.05);
   expect(resolved.attack.range).toBeGreaterThan(0);
   for(const field of Object.values(resolved.attack)) if(typeof field==='number')expect(Number.isFinite(field)).toBe(true);
   for(const status of resolved.attack.statuses) {
    expect(status.duration).toBeGreaterThan(0);
    expect(Number.isFinite(status.power)).toBe(true);
   }
   expect(new Set(resolved.attack.statuses.map(s=>s.kind)).size).toBe(resolved.attack.statuses.length);
   expect(new Set(resolved.effects.map(e=>e.id)).size).toBe(resolved.effects.length);
   expect(new Set(resolved.abilities.map(a=>a.id)).size).toBe(resolved.abilities.length);
   for (const e of resolved.effects)for(const v of [e.power,e.interval,e.duration,e.cap,e.radius])expect(Number.isFinite(v)).toBe(true);
   expect(existsSync(svgPath(resolved.visual.asset))).toBe(true);
   if (resolved.secondaryOverlay) expect(existsSync(svgPath(resolved.secondaryOverlay))).toBe(true);
  }
  expect(accepted).toBe(64);
 });

 it('has distinct and useful T1/T2 secondary benefits for all three main types', () => {
  expect(fixtureResolve([1,0,0]).attack).toMatchObject({chains:2,chainRadius:82});
  expect(fixtureResolve([1,0,0]).attack.range).toBeCloseTo(183.6);
  expect(fixtureResolve([2,0,0]).attack).toMatchObject({damage:17*1.12,interval:1.1*.94});
  const b = fixtureResolve([0,2,0]).attack;
  expect(b.armorPierce).toBe(4);
  expect(b.shieldMultiplier).toBeCloseTo(1.1*1.35);
  expect(b.detects).toBe(true);
  expect(b.statuses).toContainEqual({kind:'mark',power:.1,duration:3.6});
  const c = fixtureResolve([0,0,2]).attack;
  expect(c.push).toBe(8);
  expect(c.interval).toBeCloseTo(1.1*.94);
  expect(c.statuses).toContainEqual({kind:'stun',power:1,duration:.22});
 });

 it('has six final main/secondary pairs, their overlay and unique climax behavior', () => {
  for(const [main,second] of [[0,1],[0,2],[1,0],[1,2],[2,0],[2,1]]) {
   const t:Tiers=[0,0,0];t[main]=5;t[second]=2;
   const r = fixtureResolve(t);
   expect(r.mainPath).toBe(main);
   expect(r.visual.asset).toBe(`/art/towers/tesla/${'abc'[main]}5.svg`);
   expect(r.secondaryOverlay).toBe(`/art/towers/tesla/${'abc'[second]}2-overlay.svg`);
   expect(r.attack.count).toBe(2);
  }
  const a=fixtureResolve([5,2,0]);
  expect([a.attack.mode,a.attack.chains,a.attack.count]).toEqual(['chain',10,2]);
  expect(a.effects).toContainEqual(expect.objectContaining({kind:'echo',power:.42,cap:2,radius:128}));
  const b=fixtureResolve([2,5,0]);
  expect([b.attack.mode,b.attack.pierce,b.attack.count]).toEqual(['beam',12,2]);
  expect(b.attack.shieldMultiplier).toBeCloseTo(1.1*1.35*1.25*1.2);
  expect(b.abilities).toContainEqual(expect.objectContaining({kind:'nova',power:340,cooldown:45}));
  const c=fixtureResolve([0,2,5]);
  expect([c.attack.mode,c.attack.pierce,c.attack.splash,c.attack.count]).toEqual(['ring',14,197,2]);
  expect(c.attack.statuses).toContainEqual({kind:'stun',power:1,duration:.7});
  expect(c.effects).toContainEqual(expect.objectContaining({kind:'echo',power:.35,interval:2,radius:100}));
  expect(c.abilities).toContainEqual(expect.objectContaining({kind:'nova',power:260,cooldown:55}));
 });

 it('has no inflationary effect and never refunds more than 70% of real investment', () => {
  const def = getTower();
  for(const p of def.paths) for(const u of p.upgrades) {
   expect(u.effects?.some(e=>e.kind==='income'||e.kind==='interest'||e.kind==='harvest'||e.kind==='aura')).not.toBe(true);
  }
  for(const main of [0,1,2])for(const other of [0,1,2])if(main!==other) {
   const invested=800+def.paths[main].upgrades.reduce((n,u)=>n+u.cost,0)
    +def.paths[other].upgrades.slice(0,2).reduce((n,u)=>n+u.cost,0);
   expect(sellRefund(invested)).toBe(Math.floor(.7*invested));
   expect(sellRefund(invested)).toBeLessThan(invested);
  }
 });

 it('clones deeply so game instances cannot mutate catalog data', () => {
  const first=getTower();
  first.attack.damage=1;
  first.paths[0].upgrades[1].addStatuses![0].duration=999;
  first.paths[1].upgrades[4].abilities![0].power=0;
  const second=getTower();
  expect(second.attack.damage).toBe(17);
  expect(second.paths[0].upgrades[1].addStatuses![0].duration).toBe(3);
  expect(second.paths[1].upgrades[4].abilities![0].power).toBe(340);
 });
});

describe('self-contained artwork and crosspath gallery', () => {
 it('has 16 full frames, six overlays and one locally linked gallery', () => {
  const dir=resolve(process.cwd(),'public/art/towers/tesla');
  const ids=['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(n=>`${p}${n}`)),
   ...['a','b','c'].flatMap(p=>[1,2].map(n=>`${p}${n}-overlay`))];
  expect(ids).toHaveLength(22);
  for (const id of ids) {
   const file=resolve(dir,`${id}.svg`);
   expect(existsSync(file)).toBe(true);
   const svg=readFileSync(file,'utf8');
   expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*viewBox="0 0 128 128"/);
   expect(svg).toMatch(/<path|<polygon|<ellipse/);
   expect(svg).not.toMatch(/<script|<text|<foreignObject|<image|xlink:href|href="https?:|url\(https?:|onload=|<!DOCTYPE/i);
  }
  const gallery=readFileSync(resolve(dir,'preview.html'),'utf8');
  expect(gallery).not.toMatch(/<script|https?:\/\/|onclick=|onload=/);
  for(const id of ids.filter(id=>!id.endsWith('-overlay'))) expect(gallery).toContain(`${id}.svg`);
  for (const p of ['a','b','c']) expect(gallery).toContain(`${p}2-overlay.svg`);
  expect((gallery.match(/class="stage"/g)??[])).toHaveLength(22);
 });
});
