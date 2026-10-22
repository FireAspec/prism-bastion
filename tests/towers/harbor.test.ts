import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import type {AttackDef, EffectDef, PathIndex, ResolvedTower, StatDelta, Tiers, TowerDef} from '../../src/contracts';
import {canUpgrade, legalTiers, sellRefund} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/harbor';

const expectedCosts = [
  [375, 750, 1875, 4500, 11250],
  [395, 790, 1970, 4725, 11815],
  [360, 715, 1785, 4275, 10690],
];
const files = fileURLToPath(new URL('../../public/art/towers/harbor/', import.meta.url));

/** Fixture of the frozen resolver rules, not a stand-in combat engine. */
function fixtureResolve(def: TowerDef, tiers: Tiers): ResolvedTower {
  if (!legalTiers(tiers)) throw new RangeError('Illegal tiers');
  const main = ([0, 1, 2] as PathIndex[]).find(p => tiers[p] > 2)
    ?? ([0, 1, 2] as PathIndex[]).find(p => tiers[p] > 0);
  const secondary = ([0, 1, 2] as PathIndex[]).find(p => p !== main && tiers[p] > 0);
  const all = def.paths.map((p, index) => p.upgrades.slice(0, tiers[index]));
  const replacement = main === undefined ? undefined : [...all[main]].reverse().find(u => u.replaceAttack)?.replaceAttack;
  const attack = structuredClone(replacement ?? def.attack);
  const effects = new Map<string, EffectDef>(def.effects.map(e => [e.id, e]));
  const abilities = new Map(def.abilities.map(a => [a.id, a]));
  const statuses = new Map(attack.statuses.map(s => [s.kind, s]));
  for (const branch of all) for (const item of branch) {
    const d: StatDelta = item.delta;
    for (const [k, value] of Object.entries(d)) {
      if (typeof value === 'boolean') {if (k === 'detects' && value) attack.detects = true; continue;}
      const multiplicative: Partial<Record<keyof StatDelta, keyof AttackDef>> = {
        damageMul: 'damage', intervalMul: 'interval', rangeMul: 'range',
        shieldMultiplierMul: 'shieldMultiplier', bossMultiplierMul: 'bossMultiplier',
        projectileSpeedMul: 'projectileSpeed', windupMul: 'windup',
      };
      const additive: Partial<Record<keyof StatDelta, keyof AttackDef>> = {
        pierceAdd: 'pierce', countAdd: 'count', splashAdd: 'splash',
        chainsAdd: 'chains', chainRadiusAdd: 'chainRadius', armorPierceAdd: 'armorPierce',
        executeBelowAdd: 'executeBelow', pushAdd: 'push', arcAdd: 'arc',
      };
      const mulKey = multiplicative[k as keyof StatDelta];
      const addKey = additive[k as keyof StatDelta];
      if (mulKey) (attack as unknown as Record<string, number>)[mulKey] *= value;
      if (addKey) (attack as unknown as Record<string, number>)[addKey] += value;
    }
    for (const status of item.addStatuses ?? []) {
      const prior = statuses.get(status.kind);
      statuses.set(status.kind, prior && prior.duration > status.duration ? prior : status);
    }
    for (const e of item.effects ?? []) effects.set(e.id, e);
    for (const a of item.abilities ?? []) abilities.set(a.id, a);
  }
  attack.statuses = Array.from(statuses.values());
  const overlay = secondary === undefined ? undefined : `/art/towers/harbor/${'abc'[secondary]}${tiers[secondary]}-overlay.svg`;
  return {attack, effects: [...effects.values()], abilities: [...abilities.values()],
    visual: main === undefined ? def.visual : all[main].at(-1)!.visual,
    mainPath: main, secondaryOverlay: overlay};
}

function legalMatrix(): Tiers[] {
  const states: Tiers[] = [];
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
    const t: Tiers = [a, b, c];
    if (legalTiers(t)) states.push(t);
  }
  return states;
}

describe('Дозорный причал — данные и покупка', () => {
  it('has exact base, distinct branch IDs, 15 sequential and separately priced upgrades', () => {
    const def = getTower();
    expect([def.id, def.cost, def.footprint, def.category, def.placement]).toEqual(['harbor', 750, 26, 'water', 'water']);
    expect([def.attack.damage, def.attack.interval, def.attack.range]).toEqual([13, .8, 190]);
    expect(def.paths).toHaveLength(3);
    const upgradeIds = new Set<string>();
    for (let p = 0; p < 3; p++) {
      expect(def.paths[p].upgrades).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        const u = def.paths[p].upgrades[i];
        expect(u.id).toBe(`harbor-${'abc'[p]}${i+1}`);
        expect(u.tier).toBe(i+1);
        expect(u.cost).toBe(expectedCosts[p][i]);
        expect(u.cost).toBeGreaterThan(0);
        expect(u.name.length).toBeGreaterThan(8);
        expect(u.description.length).toBeGreaterThan(25);
        expect(upgradeIds.has(u.id)).toBe(false);
        upgradeIds.add(u.id);
      }
    }
    expect(upgradeIds.size).toBe(15);
  });

  it('detaches nested definitions even if a caller mutates attacks, effects, and visuals', () => {
    const a = getTower();
    a.paths[0].upgrades[4].replaceAttack!.statuses[0].duration = 999;
    a.paths[2].upgrades[4].effects![0].power = 999999;
    a.visual.asset = '/invalid.svg';
    const b = getTower();
    expect(b.paths[0].upgrades[4].replaceAttack!.statuses[0].duration).toBe(3.5);
    expect(b.paths[2].upgrades[4].effects![0].power).toBe(500);
    expect(b.visual.asset).toContain('/base.svg');
  });

  it('checks all 64 legal states, upgrade reachability, finite resolved values and 70% resale', () => {
    const tower = getTower();
    const matrix = legalMatrix();
    expect(matrix).toHaveLength(64);
    const reached = new Set(['0,0,0']);
    for (const t of matrix) {
      const r = fixtureResolve(tower, t);
      expect(Object.values(r.attack).flatMap(v => typeof v === 'number' ? [v] : [])
        .every(n => Number.isFinite(n))).toBe(true);
      expect(r.attack.damage).toBeGreaterThan(0);
      expect(r.attack.interval).toBeGreaterThanOrEqual(.05);
      expect(r.attack.range).toBeGreaterThan(0);
      expect(r.attack.count).toBeGreaterThanOrEqual(1);
      expect(r.attack.pierce).toBeGreaterThanOrEqual(1);
      expect(new Set(r.effects.map(e => e.id)).size).toBe(r.effects.length);
      expect(new Set(r.abilities.map(a => a.id)).size).toBe(r.abilities.length);
      for (const e of r.effects) for (const v of [e.power,e.radius,e.interval,e.duration,e.cap]) expect(Number.isFinite(v)).toBe(true);
      const invested = tower.cost + t.reduce((sum, n, p) => sum + expectedCosts[p].slice(0,n).reduce((a,b)=>a+b,0),0);
      expect(sellRefund(invested)).toBe(Math.floor(invested*.7));
      expect(sellRefund(invested)).toBeLessThan(invested);
      for (let p=0;p<3;p++) if (t[p]) {
        const predecessor = [...t] as Tiers; predecessor[p]--;
        if (canUpgrade(predecessor,p as PathIndex)) expect(reached.has(predecessor.join(','))).toBe(true);
      }
      reached.add(t.join(','));
    }
    expect(reached.size).toBe(64);
    for (const bad of [[3,3,0],[1,1,1],[5,0,3],[6,0,0]] as Tiers[]) {
      expect(() => fixtureResolve(tower, bad)).toThrow(RangeError);
    }
  });

  it('gives distinct T1/T2 cross-benefits and six functional 5–2–0 finals', () => {
    const tower = getTower();
    expect(fixtureResolve(tower,[1,0,0]).attack.interval).toBeCloseTo(.728);
    expect(fixtureResolve(tower,[0,1,0]).attack.range).toBeCloseTo(220.4);
    expect(fixtureResolve(tower,[0,0,1]).effects.find(e => e.kind==='income')?.power).toBe(16);
    expect(fixtureResolve(tower,[0,2,0]).attack.armorPierce).toBe(2);
    expect(fixtureResolve(tower,[0,0,2]).effects.find(e => e.stat==='range')?.power).toBe(.1);
    const combinations: Tiers[] = [[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
    expect(new Set(combinations.map(t=>`${fixtureResolve(tower,t).visual.asset}|${fixtureResolve(tower,t).secondaryOverlay}`)).size).toBe(6);
    for (const t of combinations) {
      const resolved = fixtureResolve(tower,t);
      const primary = t.indexOf(5);
      const secondary = t.indexOf(2);
      expect(resolved.mainPath).toBe(primary);
      expect(resolved.visual.asset).toBe(`/art/towers/harbor/${'abc'[primary]}5.svg`);
      expect(resolved.secondaryOverlay).toBe(`/art/towers/harbor/${'abc'[secondary]}2-overlay.svg`);
      expect(existsSync(`${files}${'abc'[secondary]}2-overlay.svg`)).toBe(true);
      expect(resolved.attack.mode).toBe(['drone','mortar','tide'][primary]);
      if (primary === 0) expect(resolved.attack.count).toBeGreaterThanOrEqual(7);
      if (primary === 1) expect(resolved.attack.splash).toBeGreaterThanOrEqual(80);
      if (primary === 2) expect(resolved.effects.find(e=>e.id==='harbor-port-income')?.power).toBe(500);
    }
  });

  it('retains useful combat on trade path in modes forbidding income and disallows self-compounding support definitions', () => {
    const t = getTower();
    for (let tier=0;tier<=5;tier++) {
      const r = fixtureResolve(t,[0,0,tier]);
      expect(r.attack.damage/r.attack.interval).toBeGreaterThan(0);
      const auras = r.effects.filter(e=>e.kind==='aura');
      expect(auras.every(e=>e.power<=.4 && e.radius<=250)).toBe(true);
      expect(r.effects.every(e=>e.kind!=='interest' && e.kind!=='harvest')).toBe(true);
    }
    const t5 = fixtureResolve(t,[0,0,5]);
    expect(t5.effects.filter(e=>e.kind==='income')).toHaveLength(1);
    expect(t5.effects.find(e=>e.id==='harbor-port-income')?.power).toBe(500);
    expect(t5.abilities.find(a=>a.kind==='mint')?.cooldown).toBe(90);
  });
});

describe('Дозорный причал — полный визуальный инвентарь', () => {
  it('has 16 standalone SVG, six overlays, no external dependencies or text placeholders', () => {
    const names = ['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(n=>`${p}${n}`))];
    const overlays = ['a','b','c'].flatMap(p=>[1,2].map(n=>`${p}${n}-overlay`));
    expect(names).toHaveLength(16); expect(overlays).toHaveLength(6);
    for (const name of [...names,...overlays]) {
      const file = `${files}${name}.svg`;
      expect(existsSync(file),file).toBe(true);
      const content = readFileSync(file,'utf8');
      expect(content).toMatch(/<svg[^>]*viewBox="0 0 128 128"/);
      expect(content).toMatch(/<\/(?:svg)>/);
      expect(content).toMatch(/<(path|rect|ellipse|circle|polygon)\b/);
      expect(content).not.toMatch(/<\s*(text|script|foreignObject|image|use)\b/i);
      expect(content.replace('http://www.w3.org/2000/svg','')).not.toMatch(/https?:|data:|@import|<\?xml-stylesheet/i);
      expect(content.length).toBeGreaterThan(1300);
    }
    for (const p of ['a','b','c']) {
      const series = [1,2,3,4,5].map(n=>readFileSync(`${files}${p}${n}.svg`,'utf8'));
      expect(new Set(series).size).toBe(5);
      expect(series[4].length).toBeGreaterThan(6000);
    }
    const html=readFileSync(`${files}preview.html`,'utf8');
    for(const n of [...names,...overlays.filter(n=>n.endsWith('2-overlay'))]) expect(html).toContain(`${n}.svg`);
    expect(html.match(/class="combo"/g)??[]).toHaveLength(6);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
