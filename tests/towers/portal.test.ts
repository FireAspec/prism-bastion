import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, StatDelta, Tiers, TowerDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/portal';
import {legalTiers} from '../../src/contracts/rules';
import {createCombat} from '../../src/combat';

const art = resolve('public/art/towers/portal');
const expectedPrices = [[780, 1555, 3885, 9315, 23290],
  [675, 1350, 3375, 8100, 20250], [645, 1285, 3210, 7695, 19240]];

function legal(tiers: Tiers): boolean {
  return legalTiers(tiers);
}

/** Fixture implementation of the documented v1 resolution order; no combat or catalog dependency. */
function fixtureResolve(tower: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legal(tiers)) throw new RangeError(`illegal tiers ${tiers.join('-')}`);
  const mainPath = ([0,1,2] as PathIndex[]).filter(i => tiers[i] > 0)
    .sort((a,b) => tiers[b] - tiers[a] || a - b)[0];
  const chosen = mainPath === undefined ? [] : tower.paths[mainPath].upgrades.slice(0, tiers[mainPath]);
  const replacement = [...chosen].reverse().find(u => u.replaceAttack)?.replaceAttack;
  const attack = structuredClone(replacement ?? tower.attack);
  const effects = new Map(tower.effects.map(e => [e.id, structuredClone(e)]));
  const abilities = new Map(tower.abilities.map(a => [a.id, structuredClone(a)]));
  const visual = mainPath === undefined ? tower.visual : tower.paths[mainPath].upgrades[tiers[mainPath] - 1].visual;
  const multiply: (keyof StatDelta)[] = ['damageMul', 'intervalMul', 'rangeMul', 'shieldMultiplierMul',
    'bossMultiplierMul', 'projectileSpeedMul', 'windupMul'];
  const map: Partial<Record<keyof StatDelta, keyof AttackDef>> = {
    damageMul: 'damage', intervalMul: 'interval', rangeMul: 'range', shieldMultiplierMul: 'shieldMultiplier',
    bossMultiplierMul: 'bossMultiplier', projectileSpeedMul: 'projectileSpeed', windupMul: 'windup',
    pierceAdd: 'pierce', countAdd: 'count', splashAdd: 'splash', chainsAdd: 'chains',
    chainRadiusAdd: 'chainRadius', armorPierceAdd: 'armorPierce', executeBelowAdd: 'executeBelow',
    pushAdd: 'push', arcAdd: 'arc',
  };
  for (let p = 0; p < 3; p++) {
    for (const u of tower.paths[p].upgrades.slice(0, tiers[p])) {
      for (const [key, value] of Object.entries(u.delta) as [keyof StatDelta, number | boolean][]) {
        if (key === 'detects') {attack.detects ||= value as boolean; continue;}
        const attackKey = map[key];
        if (!attackKey) throw Error(`unhandled stat ${key}`);
        // All numeric delta target keys map to numbers in AttackDef.
        const current = attack[attackKey] as number;
        (attack as unknown as Record<string, unknown>)[attackKey] = multiply.includes(key)
          ? current * (value as number) : current + (value as number);
      }
      for (const status of u.addStatuses ?? []) {
        const index = attack.statuses.findIndex(s => s.kind === status.kind);
        if (index === -1) attack.statuses.push(structuredClone(status));
        else {
          const prior = attack.statuses[index];
          attack.statuses[index] = {kind: status.kind, power: Math.max(prior.power, status.power),
            duration: Math.max(prior.duration, status.duration), maxStacks: Math.max(prior.maxStacks ?? 1, status.maxStacks ?? 1)};
        }
      }
      for (const e of u.effects ?? []) effects.set(e.id, structuredClone(e));
      for (const a of u.abilities ?? []) abilities.set(a.id, structuredClone(a));
    }
  }
  const secondaryIndex = tiers.findIndex((t, i) => t > 0 && i !== mainPath);
  const secondaryOverlay = mainPath === undefined || secondaryIndex < 0 ? undefined
    : `/art/towers/portal/${'abc'[secondaryIndex]}${Math.min(2,tiers[secondaryIndex])}-overlay.svg`;
  return {attack, effects: [...effects.values()], abilities: [...abilities.values()], visual,
    secondaryOverlay, mainPath};
}

function allTiers(): Tiers[] {
  const tiers: Tiers[] = [];
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
    const next: Tiers = [a,b,c];
    if (legal(next)) tiers.push(next);
  }
  return tiers;
}

describe('portal tower v1 content and art', () => {
  it('declares the specified base and precisely 15 paid upgrades', () => {
    const tower = getTower();
    expect([tower.id,tower.category,tower.placement,tower.cost,tower.footprint]).toEqual(['portal','tech','land',1350,26]);
    expect([tower.attack.damage,tower.attack.interval,tower.attack.range]).toEqual([5,1.8,170]);
    expect(tower.paths.map(p => p.upgrades.length)).toEqual([5,5,5]);
    expect(tower.paths.map(p => p.upgrades.map(u => u.cost))).toEqual(expectedPrices);
    const ids = tower.paths.flatMap(p => p.upgrades.map(u => u.id));
    expect(new Set(ids).size).toBe(15);
    expect(ids).toEqual(['portal-a1','portal-a2','portal-a3','portal-a4','portal-a5',
      'portal-b1','portal-b2','portal-b3','portal-b4','portal-b5',
      'portal-c1','portal-c2','portal-c3','portal-c4','portal-c5']);
    tower.paths.forEach(p => p.upgrades.forEach((u, i) => {
      expect(u.tier).toBe(i+1);
      expect(u.name.length).toBeGreaterThan(5);
      expect(u.description.length).toBeGreaterThan(38);
      expect(u.cost).toBeGreaterThan(0);
      expect(Object.values(u.delta).every(v => typeof v === 'boolean' || Number.isFinite(v))).toBe(true);
    }));
  });

  it('resolves every legal combination and never yields non-finite attacks, duplicate effects or invalid overlays', () => {
    const tower = getTower();
    const combinations = allTiers();
    expect(combinations.length).toBe(64);
    for (const tiers of combinations) {
      const r = fixtureResolve(tower, tiers);
      for (const [key, value] of Object.entries(r.attack)) {
        if (typeof value === 'number') expect(Number.isFinite(value), `${tiers}/${key}`).toBe(true);
      }
      expect(r.attack.damage).toBeGreaterThan(0);
      expect(r.attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(r.attack.range).toBeGreaterThan(0);
      expect(r.attack.pierce).toBeGreaterThanOrEqual(1);
      expect(new Set(r.effects.map(e=>e.id)).size).toBe(r.effects.length);
      for (const e of r.effects) {
        expect(Object.values(e).every(v=>typeof v !== 'number' || Number.isFinite(v))).toBe(true);
        if (e.kind === 'portal') expect(e.duration).toBeGreaterThan(e.interval);
        if (e.kind === 'aura') {
          expect(['range','attackSpeed']).toContain(e.stat);
          expect(e.power).toBeLessThanOrEqual(0.5);
        }
      }
      expect(r.visual.asset).toMatch(/^\/art\/towers\/portal\/[abc][1-5]\.svg$|^\/art\/towers\/portal\/base\.svg$/);
      if (r.secondaryOverlay) expect(readFileSync(resolve(art,r.secondaryOverlay.split('/').pop()!), 'utf8')).toContain('<svg');
    }
    expect(()=>fixtureResolve(tower,[3,3,0])).toThrow();
    expect(()=>fixtureResolve(tower,[1,1,1])).toThrow();
  });

  it('keeps every final main silhouette and merges exactly one secondary overlay', () => {
    const finals: Tiers[] = [[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
    const overlays = ['b2','c2','a2','c2','a2','b2'];
    finals.forEach((tiers,i) => {
      const resolved = fixtureResolve(getTower(),tiers);
      expect(resolved.mainPath).toBe(tiers.indexOf(5));
      expect(resolved.visual.asset).toBe(`/art/towers/portal/${'abc'[tiers.indexOf(5)]}5.svg`);
      expect(resolved.secondaryOverlay).toBe(`/art/towers/portal/${overlays[i]}-overlay.svg`);
      expect(resolved.attack.damage).toBeGreaterThan(getTower().attack.damage);
    });
  });

  it('has real progressively distinct SVGs with transparent canvas and local geometry', () => {
    const files = readdirSync(art).sort();
    expect(files.filter(f=>f.endsWith('.svg'))).toHaveLength(22);
    expect(files.filter(f=>f.endsWith('.html'))).toEqual(['preview.html']);
    for (const name of ['base',...'abc'.split('').flatMap(p=>[1,2,3,4,5].map(i=>`${p}${i}`)),
      ...'abc'.split('').flatMap(p=>[1,2].map(i=>`${p}${i}-overlay`))]) {
      const xml = readFileSync(resolve(art,`${name}.svg`),'utf8');
      expect(xml).toContain('viewBox="0 0 128 128"');
      expect(xml).toMatch(/<path|<ellipse|<circle/);
      expect(xml).not.toMatch(/<script|<text|<image|<foreignObject|href="https?:|url\(https?:/i);
      expect(xml).not.toMatch(/<rect[^>]*width="128"[^>]*height="128"/);
    }
    for (const p of ['a','b','c']) {
      const states = Array.from({length:6},(_,i)=>readFileSync(resolve(art,`${i?`${p}${i}`:'base'}.svg`),'utf8'));
      expect(new Set(states).size).toBe(6);
      expect(states[5].length).toBeGreaterThan(states[2].length + 200);
    }
    const preview = readFileSync(resolve(art,'preview.html'),'utf8');
    expect((preview.match(/Финальный кросс-путь/g)??[]).length).toBe(6);
    for (const f of files.filter(f=>f.endsWith('.svg'))) expect(preview).toContain(`${f}`);
  });

  it('keeps copies independent, disables self-amplifying support and caps control semantically', () => {
    const one = getTower(); const two = getTower();
    one.paths[0].upgrades[0].cost = 1;
    expect(two.paths[0].upgrades[0].cost).toBe(780);
    const finalA = fixtureResolve(two,[5,0,0]);
    const warp = finalA.effects.find(e=>e.kind==='portal')!;
    expect([warp.power, warp.interval, warp.duration, warp.radius]).toEqual([135,3.5,7,235]);
    // Contract fixture: immunity is stored on each enemy, not on the portal and not in the renderer.
    const enemy = {progress: 240, immuneUntil: 0};
    const apply = (now:number) => {
      if(now < enemy.immuneUntil) return false;
      enemy.progress = Math.max(0, enemy.progress - warp.power);
      enemy.immuneUntil = now + warp.duration;
      return true;
    };
    expect(apply(10)).toBe(true);
    expect(enemy.progress).toBe(105);
    expect(apply(13.5)).toBe(false);
    expect(apply(17.01)).toBe(true);
    expect(enemy.progress).toBe(0);
    const support = fixtureResolve(two,[0,0,5]).effects.filter(e=>e.kind==='aura');
    expect(support.map(e=>[e.stat,e.power,e.radius])).toEqual([['range',0.22,265],['attackSpeed',0.24,265]]);
    expect(two.effects).toHaveLength(0);
    expect(two.paths[2].upgrades[4].effects?.every(e=>e.kind==='aura')).toBe(true);
    // No effect targets its own source: implementation-side aura rule is part of v1 contract.
  });
});

describe('portal regression cases', () => {
  it('keeps the larger early path visible and chooses the smaller index only on ties', () => {
    expect(fixtureResolve(getTower(), [1,2,0]).visual.asset).toBe('/art/towers/portal/b2.svg');
    expect(fixtureResolve(getTower(), [1,2,0]).secondaryOverlay).toBe('/art/towers/portal/a1-overlay.svg');
    expect(fixtureResolve(getTower(), [2,2,0]).mainPath).toBe(0);
  });
  it('does not consume the portal immunity with its own basic attacks', () => {
    for (const tiers of allTiers()) expect(fixtureResolve(getTower(), tiers).attack.push).toBe(0);
    const a5 = fixtureResolve(getTower(), [5,0,0]);
    expect(a5.attack.statuses.find(s => s.kind === 'slow')?.power).toBe(.2);
    expect(a5.abilities[0].duration).toBe(7);
    expect(a5.attack.statuses.find(s => s.kind === 'mark')?.duration).toBe(2);
  });
  it('gives B2 penetration and B5 a real blast plus one delayed echo definition', () => {
    expect(fixtureResolve(getTower(), [0,2,0]).attack.pierce).toBe(2);
    const b5 = fixtureResolve(getTower(), [2,5,0]);
    expect(b5.attack.mode).toBe('splash');
    expect(b5.attack.splash).toBe(124);
    expect(b5.attack.projectileSpeed).toBeGreaterThan(0);
    expect(b5.attack.statuses.find(s => s.kind === 'slow')?.power).toBe(.3);
    expect(b5.effects.filter(e => e.kind === 'echo')).toHaveLength(1);
    expect(b5.effects[0]).toMatchObject({power:.35, interval:3.4, cap:4, radius:135});
  });
  it('keeps C5 active acceleration separate from its persistent auras', () => {
    const c5 = fixtureResolve(getTower(), [0,0,5]);
    expect(c5.abilities[0]).toMatchObject({kind:'overclock', radius:0, power:.3, duration:7, cooldown:70});
    expect(c5.effects).toHaveLength(2);
  });
  it('provides different attack visual identifiers for every purchased state', () => {
    const tower = getTower();
    const visuals = [tower.visual, ...tower.paths.flatMap(path => path.upgrades.map(u => u.visual))];
    for (const key of ['asset','muzzle','projectile','impact'] as const)
      expect(new Set(visuals.map(v => v[key])).size).toBe(16);
  });
});
function availableCombat() {
  try { return createCombat(); }
  catch (error) {
    if (error instanceof Error && error.message === 'Combat module pending') return undefined;
    throw error;
  }
}
const combat = availableCombat();
describe.skipIf(!combat)('portal with production combat (runs after integration)', () => {
  it('matches the independent contract fixture on all 64 legal combinations', () => {
    const tower = getTower();
    for (const tiers of allTiers()) {
      const expected = fixtureResolve(tower, tiers);
      const actual = combat!.resolveTower(tower, tiers);
      expect(actual.attack).toEqual(expected.attack);
      expect(actual.effects).toEqual(expected.effects);
      expect(actual.abilities).toEqual(expected.abilities);
      expect(actual.visual).toEqual(expected.visual);
      expect(actual.mainPath).toBe(expected.mainPath);
      expect(actual.secondaryOverlay).toBe(expected.secondaryOverlay);
    }
  });
});
