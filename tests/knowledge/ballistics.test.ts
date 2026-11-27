import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import type { KnowledgeStat } from '../../src/contracts';
import { getKnowledge } from '../../src/content/knowledge/ballistics';

const ids = ['needle','cannon','rail','scatter','saw','mortar','rocket','drone'];
const stats = ['weaponDamage','weaponSpeed','weaponRange','bossDamage'] as const;
const caps = [15,12,10,6];
const expected = [[10,8,6,3],[12,6,6,5],[10,7,9,5],[10,7,8,3],[10,7,8,3],[12,6,6,5],[12,7,8,5],[6,6,6,3]];
const nodes = getKnowledge();
// Independent test double: apply unique owned IDs to an eligible weapon/tech attack.
function bonus(owned: string[], tower: string, stat: KnowledgeStat, mode = 'standard'): number {
  if (mode === 'iron-oath') return 0;
  const selected = new Set(owned);
  return nodes.filter(n => selected.has(n.id)).flatMap(n => n.effects)
    .filter(e => e.stat === stat && (!e.towers || e.towers.includes(tower)))
    .reduce((sum,e) => sum + e.value,0);
}
const owned = (n: number) => nodes.slice(0,n).map(x => x.id);

describe('ballistics catalog', () => {
  it('has the exact linear chain, prices and level boundaries', () => {
    expect(nodes).toHaveLength(30);
    expect(new Set(nodes.map(n => n.id)).size).toBe(30);
    expect(new Set(nodes.map(n => n.name)).size).toBe(30);
    const costs = [30,35,40,50,55,65,75,85,95,105,120,130,145,160,170,190,205,220,240,255,275,295,315,335,355,380,400,425,450,470];
    nodes.forEach((n,i) => {
      expect(n.id).toBe(`ballistics-${String(i+1).padStart(2,'0')}`);
      expect(n.branch).toBe('ballistics');
      expect(n.index).toBe(i+1);
      expect(n.requires).toEqual(i === 0 ? [] : [nodes[i-1].id]);
      expect(n.minLevel).toBe([1,5,9,13,17,21][Math.floor(i/5)]);
      expect(n.pointCost).toBe(1);
      expect(n.sealCost).toBe(costs[i]);
      expect(n.description.length).toBeGreaterThan(20);
      expect(n.effects.length).toBeGreaterThanOrEqual((i+1)%5 === 0 ? 2 : 1);
      for (const e of n.effects) {
        expect(stats).toContain(e.stat);
        expect(Number.isFinite(e.value) && e.value > 0).toBe(true);
        expect(e.towers?.length).toBeGreaterThan(0);
        expect(new Set(e.towers).size).toBe(e.towers?.length);
        expect(e.towers?.every(t => ids.includes(t))).toBe(true);
      }
    });
    expect(nodes.reduce((sum,n) => sum+n.sealCost,0)).toBe(6170);
  });
  it('matches the full profile per target and retains every incremental effect', () => {
    ids.forEach((t,i) => stats.forEach((s,j) => {
      expect(bonus(owned(30),t,s)*100).toBeCloseTo(expected[i][j],8);
      expect(bonus(owned(30),t,s)*100).toBeLessThanOrEqual(caps[j]+1e-8);
    }));
    nodes.forEach((_,i) => {
      expect(ids.some(t => stats.some((s,j) => Math.min(caps[j]/100,bonus(owned(i+1),t,s)) > Math.min(caps[j]/100,bonus(owned(i),t,s))+1e-8))).toBe(true);
    });
    expect(bonus(owned(5),'needle','weaponDamage')).toBeCloseTo(.02);
    expect(bonus(owned(15),'cannon','weaponDamage')).toBeCloseTo(.05);
    expect(bonus(owned(30),'beacon','weaponDamage')).toBe(0);
    expect(bonus(owned(30),'frost','weaponDamage')).toBe(0);
    expect(bonus(owned(30),'harbor','weaponDamage')).toBe(0);
    expect(bonus([...owned(30),...owned(30)],'needle','weaponDamage')).toBeCloseTo(.10);
    ids.forEach(t => stats.forEach(s => expect(bonus(owned(30),t,s,'iron-oath')).toBe(0)));
  });
  it('does not leak mutable data between calls', () => {
    const copy = getKnowledge();
    copy[1].requires.push('invalid');
    copy[0].effects[0].value = 999;
    copy[0].effects[0].towers?.push('beacon');
    expect(getKnowledge()).toEqual(nodes);
  });
  it('has unique local self-contained icon assets', () => {
    const contents = new Set<string>();
    for (const n of nodes) {
      expect(n.icon).toBe(`art/knowledge/ballistics/${n.id}.svg`);
      const path = `public/${n.icon}`;
      expect(existsSync(path)).toBe(true);
      const svg = readFileSync(path,'utf8');
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg).not.toMatch(/<script|<image|(?:xlink:)?href=|<foreignObject|\bon\w+=/i);
      contents.add(svg.replace(/<title>.*?<\/title>/g,''));
    }
    expect(contents.size).toBe(30);
  });
});
