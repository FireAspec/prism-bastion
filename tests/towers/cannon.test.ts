import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {AttackDef, PathIndex, StatDelta, Tiers, TowerDef} from '../../src/contracts';
import {canUpgrade, legalTiers, sellRefund, upgradeCost} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/cannon';

const RESOURCE_DIR = join(process.cwd(), 'public/art/towers/cannon');
const expectedCosts = [[275, 550, 1375, 3300, 8250], [305, 605, 1515, 3630, 9075], [250, 495, 1240, 2970, 7425]];
const attackNumbers: (keyof AttackDef)[] = [
  'damage', 'interval', 'range', 'pierce', 'count', 'splash', 'chains', 'chainRadius',
  'armorPierce', 'shieldMultiplier', 'bossMultiplier', 'executeBelow', 'push',
  'projectileSpeed', 'projectileRadius', 'windup', 'arc',
];

/** Independent fixture of the v1 resolution sequence while src/combat is pending. */
function fixtureResolve(def: TowerDef, tiers: Tiers) {
  if (!legalTiers(tiers)) throw new RangeError('Illegal tier combination');
  const ordered = [0, 1, 2] as PathIndex[];
  const active = ordered.filter(index => tiers[index] > 0);
  const main = active.sort((a, b) => tiers[b] - tiers[a] || a - b)[0];
  const secondary = active.find(index => index !== main);
  let attack: AttackDef = structuredClone(def.attack);
  if (main !== undefined) {
    for (const u of def.paths[main].upgrades.slice(0, tiers[main])) {
      if (u.replaceAttack) attack = structuredClone(u.replaceAttack);
    }
  }
  const multipliers: Partial<Record<keyof StatDelta, keyof AttackDef>> = {
    damageMul: 'damage', intervalMul: 'interval', rangeMul: 'range',
    shieldMultiplierMul: 'shieldMultiplier', bossMultiplierMul: 'bossMultiplier',
    projectileSpeedMul: 'projectileSpeed', windupMul: 'windup',
  };
  const additions: Partial<Record<keyof StatDelta, keyof AttackDef>> = {
    pierceAdd: 'pierce', countAdd: 'count', splashAdd: 'splash',
    chainsAdd: 'chains', chainRadiusAdd: 'chainRadius', armorPierceAdd: 'armorPierce',
    executeBelowAdd: 'executeBelow', pushAdd: 'push', arcAdd: 'arc',
  };
  for (const p of ordered) for (const u of def.paths[p].upgrades.slice(0, tiers[p])) {
    for (const [key, factor] of Object.entries(u.delta) as [keyof StatDelta, number | boolean][]) {
      if (key === 'detects') {
        attack.detects = attack.detects || Boolean(factor);
        continue;
      }
      const mul = multipliers[key];
      const add = additions[key];
      if (mul) (attack as unknown as Record<string, number>)[mul] *= Number(factor);
      else if (add) (attack as unknown as Record<string, number>)[add] += Number(factor);
      else throw new Error('Undocumented stat delta ' + key);
    }
  }
  const visual = main === undefined ? def.visual : def.paths[main].upgrades[tiers[main]-1].visual;
  const secondaryOverlay = secondary === undefined ? undefined : `/art/towers/cannon/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`;
  return {attack, visual, mainPath: main, secondaryOverlay};
}

describe('Cannon tower catalog', () => {
  it('provides original core stats and a detached independent tree', () => {
    const first = getTower(), second = getTower();
    expect([first.id, first.cost, first.footprint, first.category, first.placement]).toEqual(['cannon', 550, 26, 'weapon', 'land']);
    expect([first.attack.mode, first.attack.damage, first.attack.interval, first.attack.range]).toEqual(['shot', 30, 1.7, 170]);
    first.attack.damage = -1;
    first.paths[0].upgrades[2].replaceAttack!.statuses.push({kind:'stun', power:1,duration:999});
    expect(second.attack.damage).toBe(30);
    expect(getTower().paths[0].upgrades[2].replaceAttack!.statuses).toEqual([]);
  });

  it('has three sequential paths, 15 unique updates, and exact normal prices', () => {
    const tower = getTower(), ids = new Set<string>();
    expect(tower.paths).toHaveLength(3);
    tower.paths.forEach((path, p) => {
      expect(path.upgrades).toHaveLength(5);
      expect(path.id).toBeTruthy();
      path.upgrades.forEach((u, i) => {
        expect(u.tier).toBe(i+1);
        expect(u.cost).toBe(expectedCosts[p][i]);
        expect(u.cost).toBe(upgradeCost(tower.cost, [1,1.1,0.9][p], u.tier));
        expect(u.id).toBe(`cannon-${'abc'[p]}${i+1}`);
        expect(ids.has(u.id)).toBe(false);
        ids.add(u.id);
        expect(u.name.length).toBeGreaterThan(7);
        expect(u.description.length).toBeGreaterThan(40);
        if (i < 2) expect(u.replaceAttack).toBeUndefined();
        if (i === 2 || i === 4) expect(u.replaceAttack).toBeDefined();
      });
    });
    expect(ids.size).toBe(15);
  });

  it('resolves the entire legal 6×6×6 state matrix with finite effective attacks and valid assets', () => {
    const tower = getTower();
    let legal = 0;
    for (let a=0;a<=5;a++) for (let b=0;b<=5;b++) for (let c=0;c<=5;c++) {
      const tiers: Tiers = [a,b,c];
      if (!legalTiers(tiers)) {
        expect(() => fixtureResolve(tower, tiers)).toThrow();
        continue;
      }
      legal++;
      const result = fixtureResolve(tower, tiers);
      const attack = result.attack;
      for (const key of attackNumbers) {
        const value = attack[key];
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(attack.damage).toBeGreaterThan(0);
      expect(attack.interval).toBeGreaterThanOrEqual(0.05);
      expect(attack.range).toBeGreaterThan(0);
      expect(attack.count).toBeGreaterThanOrEqual(1);
      expect(attack.pierce).toBeGreaterThanOrEqual(1);
      expect(attack.statuses.every(s => Number.isFinite(s.power) && Number.isFinite(s.duration) && s.duration > 0)).toBe(true);
      expect(existsSync(join(RESOURCE_DIR, result.visual.asset.split('/').at(-1)!))).toBe(true);
      if(result.secondaryOverlay) {
        expect(existsSync(join(RESOURCE_DIR, result.secondaryOverlay.split('/').at(-1)!))).toBe(true);
      }
      for (const p of [0,1,2] as PathIndex[]) {
        const increment: Tiers = [...tiers]; increment[p]++;
        expect(canUpgrade(tiers,p)).toBe(legalTiers(increment));
      }
    }
    expect(legal).toBe(64);
  });

  it('keeps all six specializations at 5–2–0 with primary attack and visible overlay', () => {
    const t = getTower();
    const cases: {tiers:Tiers; mode:AttackDef['mode']; count:number; splash:number; overlay:string}[] = [
      {tiers:[5,2,0],mode:'splash',count:2,splash:76,overlay:'b2-overlay.svg'},
      {tiers:[5,0,2],mode:'splash',count:2,splash:76,overlay:'c2-overlay.svg'},
      {tiers:[2,5,0],mode:'cone',count:7,splash:0,overlay:'a2-overlay.svg'},
      {tiers:[0,5,2],mode:'cone',count:7,splash:0,overlay:'c2-overlay.svg'},
      {tiers:[2,0,5],mode:'splash',count:1,splash:68,overlay:'a2-overlay.svg'},
      {tiers:[0,2,5],mode:'splash',count:1,splash:68,overlay:'b2-overlay.svg'},
    ];
    for (const item of cases) {
      const r = fixtureResolve(t, item.tiers);
      expect(r.attack.mode).toBe(item.mode);
      expect(r.attack.count).toBe(item.count);
      expect(r.attack.splash).toBe(item.splash);
      expect(r.secondaryOverlay).toContain(item.overlay);
      expect(r.visual.asset).toContain(`/${'abc'[r.mainPath!] }5.svg`);
      expect(sellRefund(t.cost + t.paths.reduce((sum,p,index) => sum+p.upgrades.slice(0,item.tiers[index]).reduce((s,u)=>s+u.cost,0),0)))
        .toBeLessThan(t.cost+t.paths.reduce((sum,p,index) => sum+p.upgrades.slice(0,item.tiers[index]).reduce((s,u)=>s+u.cost,0),0));
    }
  });

  it('applies T1/T2 boosts on unrelated T5 forms without erasing attack or statuses', () => {
    const t = getTower();
    const aWithB = fixtureResolve(t,[5,2,0]);
    expect(aWithB.attack.damage).toBe(120);
    expect(aWithB.attack.interval).toBeCloseTo(2.009,8);
    expect(aWithB.attack.range).toBeCloseTo(212.636,7);
    expect(aWithB.attack.bossMultiplier).toBeCloseTo(1.55*1.1*1.24,7);
    const bWithC = fixtureResolve(t,[0,5,2]);
    expect(bWithC.attack.armorPierce).toBe(5);
    expect(bWithC.attack.push).toBe(7);
    expect(bWithC.attack.shieldMultiplier).toBeCloseTo(1.18);
    const cWithA = fixtureResolve(t,[2,0,5]);
    expect(cWithA.attack.damage).toBeCloseTo(99*1.25*1.13);
    expect(cWithA.attack.statuses).toEqual([
      {kind:'stun',power:1,duration:0.32},
      {kind:'shred',power:15,duration:3.4},
    ]);
  });

  it('uses semantic attack mode changes at T3 and stronger T5 effects beyond plain damage', () => {
    const tower = getTower();
    const before = [fixtureResolve(tower,[2,0,0]).attack, fixtureResolve(tower,[0,2,0]).attack, fixtureResolve(tower,[0,0,2]).attack];
    const third = [fixtureResolve(tower,[3,0,0]).attack, fixtureResolve(tower,[0,3,0]).attack, fixtureResolve(tower,[0,0,3]).attack];
    expect(before.every(a=>a.mode==='shot')).toBe(true);
    expect(third.map(a=>a.mode)).toEqual(['splash','cone','splash']);
    expect(third[2].statuses.map(s=>s.kind)).toEqual(['stun','shred']);
    const finals = [fixtureResolve(tower,[5,0,0]).attack,fixtureResolve(tower,[0,5,0]).attack,fixtureResolve(tower,[0,0,5]).attack];
    expect(finals[0].count).toBe(2);
    expect(finals[0].splash).toBeGreaterThan(third[0].splash);
    expect(finals[1].count).toBe(7);
    expect(finals[1].arc).toBeGreaterThan(third[1].arc);
    expect(finals[2].statuses[0].duration).toBeGreaterThan(third[2].statuses[0].duration);
    expect(finals[2].splash).toBeGreaterThan(third[2].splash);
  });

  it('provides 16 128px standalone illustrations, six true transparent overlays, and offline HTML gallery', () => {
    const files = ['base', ...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(t=>p+t)), ...['a','b','c'].flatMap(p=>[1,2].map(t=>`${p}${t}-overlay`))];
    expect(files).toHaveLength(22);
    const all = new Set<string>();
    for(const name of files) {
      const file = join(RESOURCE_DIR, `${name}.svg`);
      expect(existsSync(file)).toBe(true);
      const content = readFileSync(file, 'utf8');
      expect(content).toMatch(/<svg\s[^>]*width="128"[^>]*height="128"[^>]*viewBox="0 0 128 128"/);
      expect(content).toMatch(/<\/svg>\s*$/);
      expect(content).not.toMatch(/<\s*(script|foreignObject|text|image)\b/i);
      expect(content).not.toMatch(/(?:\bhref\s*=\s*["']\s*(?:https?:|data:|javascript:)|<iframe|@import)/i);
      expect(content).toMatch(/<(?:path|polygon|rect|circle|ellipse)\s/);
      all.add(content);
    }
    expect(all.size).toBe(22);
    const html=readFileSync(join(RESOURCE_DIR,'preview.html'),'utf8');
    for (const f of files) expect(html).toContain(`${f}.svg`);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
