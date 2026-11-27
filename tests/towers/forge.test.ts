import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {legalTiers, canUpgrade, sellRefund} from '../../src/contracts/rules';
import type {AbilityDef, EffectDef, PathIndex, ResolvedTower, Tiers, TowerDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/forge';

const prices = [[375, 750, 1875, 4500, 11250], [395, 790, 1970, 4725, 11815], [360, 715, 1785, 4275, 10690]];
const branchIds = ['a', 'b', 'c'] as const;

/** A test double of frozen v1's specified merge order, independent of the future combat module. */
function resolveFixture(tower: TowerDef, tiers: Tiers): ResolvedTower {
 if (!legalTiers(tiers)) throw new RangeError('Illegal upgrade combination');
 const effects = new Map<string, EffectDef>(tower.effects.map(effect => [effect.id, structuredClone(effect)]));
 const abilities = new Map<string, AbilityDef>(tower.abilities.map(ability => [ability.id, structuredClone(ability)]));
 for (const path of [0, 1, 2] as PathIndex[]) {
  for (let tier = 1; tier <= tiers[path]; tier++) {
   const u = tower.paths[path].upgrades[tier - 1];
   for (const e of u.effects ?? []) effects.set(e.id, structuredClone(e));
   for (const a of u.abilities ?? []) abilities.set(a.id, structuredClone(a));
  }
 }
 const main = [0, 1, 2].filter(i => tiers[i] > 0).sort((a,b) => tiers[b] - tiers[a] || a - b)[0] ?? -1;
 const secondary = tiers.findIndex((n, i) => i !== main && n > 0);
 const active = main >= 0 ? tower.paths[main].upgrades[tiers[main] - 1].visual : tower.visual;
 return {
  attack: structuredClone(main >= 0 && tiers[main] >= 3 ? tower.paths[main].upgrades.slice(0, tiers[main]).reverse().find(u => u.replaceAttack)?.replaceAttack ?? tower.attack : tower.attack), effects: [...effects.values()], abilities: [...abilities.values()],
  visual: structuredClone(active), ...(main >= 0 ? {mainPath: main as PathIndex} : {}),
  ...(secondary >= 0 ? {secondaryOverlay: `/art/towers/forge/${branchIds[secondary]}${tiers[secondary]}-overlay.svg`} : {}),
 };
}

function strongest(resolved: ResolvedTower, stat: EffectDef['stat']): number {
 return Math.max(0, ...resolved.effects.filter(e => e.kind === 'aura' && e.stat === stat).map(e => e.power));
}

function asset(path: string): string {
 expect(path.startsWith('/art/towers/forge/')).toBe(true);
 const fsPath = resolve('public', path.slice(1));
 expect(existsSync(fsPath), `Missing ${path}`).toBe(true);
 return readFileSync(fsPath, 'utf8');
}

describe('forge static content', () => {
 it('has its own useful base function, consistent category and placement', () => {
  const t = getTower();
  expect(t.id).toBe('forge'); expect(t.category).toBe('support');
  expect(t.placement).toBe('land'); expect(t.cost).toBe(750);
  expect(t.footprint).toBeGreaterThanOrEqual(22); expect(t.footprint).toBeLessThanOrEqual(28);
  expect(t.attack.damage).toBe(0); expect(t.attack.interval).toBe(1);
  expect(t.attack.range).toBe(145);
  expect(strongest(resolveFixture(t, [0, 0, 0]), 'damage')).toBe(0.06);
 });

 it('provides 15 unique sequenced tiers at the exact individual costs', () => {
  const t = getTower(); const ids = new Set<string>();
  expect(t.paths).toHaveLength(3);
  for (let p = 0; p < 3; p++) {
   expect(t.paths[p].upgrades).toHaveLength(5);
   expect(t.paths[p].id).toBeTruthy();
   for (let i = 0; i < 5; i++) {
    const u = t.paths[p].upgrades[i];
    expect(u.id).toBe(`forge-${branchIds[p]}${i + 1}`);
    expect(ids.has(u.id)).toBe(false); ids.add(u.id);
    expect(u.tier).toBe(i + 1); expect(u.cost).toBe(prices[p][i]);
    expect(u.name.length).toBeGreaterThan(6); expect(u.description.length).toBeGreaterThan(25);
    expect(u.effects?.length).toBeGreaterThan(0);
    expect(Object.keys(u.delta)).toHaveLength(0); // non-damaging support: live effects do the work
    if (p === 2 && i >= 2) expect(u.replaceAttack?.damage).toBeGreaterThan(0);
    else expect(u.replaceAttack).toBeUndefined();
   }
  }
  expect(ids.size).toBe(15);
 });

 it('returns fully independent copies, including nested effects and paths', () => {
  const a = getTower(); const b = getTower();
  a.effects[0].power = -1;
  a.paths[0].upgrades[0].effects![0].power = -2;
  a.paths[2].upgrades[2].abilities![0].duration = -3;
  expect(b.effects[0].power).toBe(.06);
  expect(b.paths[0].upgrades[0].effects![0].power).toBe(.1);
  expect(b.paths[2].upgrades[2].abilities![0].duration).toBe(6);
 });

 it('has only finite typed effect parameters, distinct IDs at each resolved tier, and bounded economy', () => {
  const t = getTower();
  const all = [t.effects, ...t.paths.flatMap(p => p.upgrades.map(u => u.effects ?? []))];
  for (const effects of all) for (const effect of effects) {
   for (const key of ['power', 'radius', 'interval', 'duration', 'cap'] as const)
    expect(Number.isFinite(effect[key]), `${effect.id}.${key}`).toBe(true);
   expect(effect.power).toBeGreaterThanOrEqual(0);
   expect(effect.radius).toBeGreaterThanOrEqual(0);
   if (effect.kind === 'aura') expect(effect.stat).toBeDefined();
  }
  for (const u of t.paths.flatMap(p => p.upgrades)) for (const a of u.abilities ?? []) {
   for (const n of [a.cooldown, a.power, a.duration, a.radius]) expect(Number.isFinite(n)).toBe(true);
   expect(a.cooldown).toBeGreaterThan(a.duration);
  }
  const invested = t.cost + prices[1].reduce((sum, n) => sum + n, 0);
  expect(invested).toBe(20445);
  expect(sellRefund(invested)).toBe(14311);
  expect(sellRefund(invested)).toBeLessThan(invested);
 });
});

describe('complete legal upgrade matrix / fixture resolver', () => {
 it('can resolve every legal combination and independently validate all transitions', () => {
  const t = getTower(); let legal = 0; let transitions = 0;
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
   const tiers: Tiers = [a, b, c];
   if (!legalTiers(tiers)) continue;
   legal++;
   const r = resolveFixture(t, tiers);
   expect(r.attack.damage).toBe(tiers[2] >= 3 ? [24,40,65][tiers[2]-3] : 0);
   expect(r.effects.map(e => e.id).length).toBe(new Set(r.effects.map(e => e.id)).size);
   expect(r.abilities.map(e => e.id).length).toBe(new Set(r.abilities.map(e => e.id)).size);
   expect(strongest(r, 'damage')).toBeLessThanOrEqual(.4);
   expect(strongest(r, 'attackSpeed')).toBeLessThanOrEqual(.35);
   expect(strongest(r, 'discount')).toBeLessThanOrEqual(.15);
   const burst = r.abilities.find(ability => ability.kind === 'overclock');
   if (burst) {
    expect(r.attack.damage).toBeGreaterThan(0);
    expect(r.attack.interval / (1 + burst.power)).toBeLessThan(r.attack.interval);
    expect(burst.power).toBeLessThanOrEqual(.5);
   }
   for (const p of [0, 1, 2] as PathIndex[]) if (canUpgrade(tiers, p)) {
    const next: Tiers = [...tiers]; next[p]++;
    expect(legalTiers(next)).toBe(true);
    expect(resolveFixture(t, next).effects.length).toBeGreaterThan(0);
    transitions++;
   }
  }
  expect(legal).toBe(64);
  expect(transitions).toBeGreaterThan(0);
 });

 it('keeps six T5 primary silhouettes and visible T2 secondary overlays', () => {
  const t = getTower(); let count = 0;
  for (const main of [0, 1, 2] as PathIndex[]) for (const secondary of [0, 1, 2] as PathIndex[]) {
   if (main === secondary) continue;
   const tiers: Tiers = [0, 0, 0]; tiers[main] = 5; tiers[secondary] = 2;
   const r = resolveFixture(t, tiers); count++;
   expect(r.mainPath).toBe(main);
   expect(r.visual.asset).toBe(`/art/towers/forge/${branchIds[main]}5.svg`);
   expect(r.secondaryOverlay).toBe(`/art/towers/forge/${branchIds[secondary]}2-overlay.svg`);
   expect(asset(r.visual.asset)).toContain('<svg');
   expect(asset(r.secondaryOverlay!)).toContain('<svg');
  }
  expect(count).toBe(6);
  // Regression: the C2 cross-effect must not overwrite A5's stronger armor pierce.
  const armored = resolveFixture(t, [5, 0, 2]);
  expect(strongest(armored, 'armorPierce')).toBe(9);
  expect(strongest(armored, 'attackSpeed')).toBe(.08);
 });

 it('adds useful T1/T2 cross-effects and substantial T5 mechanics', () => {
  const t = getTower();
  expect(strongest(resolveFixture(t, [0, 5, 2]), 'armorPierce')).toBe(2);
  expect(strongest(resolveFixture(t, [2, 5, 0]), 'damage')).toBe(.1);
  expect(strongest(resolveFixture(t, [5, 2, 0]), 'discount')).toBe(.04);
  const a5 = resolveFixture(t, [5, 0, 0]);
  expect(strongest(a5, 'armorPierce')).toBe(9);
  expect(strongest(a5, 'detect')).toBe(1);
  const b4 = resolveFixture(t, [0, 4, 0]);
  const b5 = resolveFixture(t, [0, 5, 0]);
  expect(b4.effects.some(e => e.kind === 'income')).toBe(false);
  expect(b5.effects.find(e => e.kind === 'income')?.power).toBe(35);
  const c4 = resolveFixture(t, [0, 0, 4]);
  const c5 = resolveFixture(t, [0, 0, 5]);
  expect(c5.abilities[0].duration).toBeGreaterThan(c4.abilities[0].duration);
  expect(c5.abilities[0].cooldown).toBeLessThan(c4.abilities[0].cooldown);
  expect(strongest(c5, 'detect')).toBe(1);
  expect(c5.attack.detects).toBe(true);
  expect(c5.attack.splash).toBe(130);
  expect(c5.attack.damage).toBe(65);
  expect(c5.abilities[0].power).toBe(.5);
  expect(resolveFixture(t,[1,2,0]).mainPath).toBe(1);
  expect(resolveFixture(t,[2,2,0]).mainPath).toBe(0);
 });
});

describe('asset inventory and safety', () => {
 it('includes every full view, 6 overlays, and preview without external references', () => {
  const t = getTower();
  const visuals = [t.visual.asset, ...t.paths.flatMap(p => p.upgrades.map(u => u.visual.asset))];
  const overlays = branchIds.flatMap(b => [1, 2].map(n => `/art/towers/forge/${b}${n}-overlay.svg`));
  expect(new Set(visuals).size).toBe(16);
  for (const path of [...visuals, ...overlays]) {
   const svg = asset(path);
   expect(svg).toMatch(/<svg\s[^>]*viewBox="0 0 128 128"/);
   expect(svg).toContain('</svg>');
   expect(svg).not.toMatch(/<(?:script|text|image|foreignObject)\b/i);
   const withoutStandardNamespace = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
   expect(withoutStandardNamespace).not.toMatch(/(?:https?:|data:|xlink:href|@import|<iframe)/i);
   expect(svg).toMatch(/<(?:path|polygon|circle|rect|ellipse)\b/);
  }
  for (const b of branchIds) {
   expect(asset(`/art/towers/forge/${b}1.svg`)).not.toBe(asset(t.visual.asset));
   expect(asset(`/art/towers/forge/${b}2.svg`)).not.toBe(asset(`/art/towers/forge/${b}1.svg`));
   expect(asset(`/art/towers/forge/${b}5.svg`).length).toBeGreaterThan(asset(`/art/towers/forge/${b}1.svg`).length);
  }
  const preview = readFileSync(resolve('public/art/towers/forge/preview.html'), 'utf8');
  expect(preview).toContain('id="crosses"'); expect(preview).toContain('id="upgrades"');
  expect(preview).not.toMatch(/<script\s+src=|<link\s+href=/i);
 });
});
