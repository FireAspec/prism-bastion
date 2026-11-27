import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { KnowledgeNode, KnowledgeStat } from '../../src/contracts';
import { getKnowledge } from '../../src/content/knowledge/elements';

const caps = { elementDamage: 15, statusDuration: 15, shieldDamage: 20, controlDuration: 5 } as const;
type Stat = keyof typeof caps;
const towers = ['ember', 'frost', 'tesla', 'venom', 'prism', 'storm', 'rocket', 'tide', 'coral'];
const prices = [30,35,40,50,55,65,75,85,95,105,120,130,145,160,170,190,205,220,240,255,275,295,315,335,355,380,400,425,450,470];
const expected = [
  [7,7,7,0], [7,8,5,4], [7,4,12,2], [6,8,7,0], [6,4,10,0],
  [5,6,9,1], [0,3,0,0], [0,4,0,3], [0,4,0,0],
];
const stats = Object.keys(caps) as Stat[];
function total(nodes: KnowledgeNode[], stat: KnowledgeStat, tower?: string): number {
  return nodes.flatMap(n => n.effects).filter(e => e.stat === stat &&
    (!tower || !e.towers || e.towers.includes(tower)))
    .reduce((sum, e) => sum + Math.round(e.value * 100), 0);
}

describe('elements knowledge', () => {
  it('has one ordered chain, unique ids, exact level gates and seal prices', () => {
    const nodes = getKnowledge();
    expect(nodes).toHaveLength(30);
    expect(new Set(nodes.map(n => n.id)).size).toBe(30);
    expect(new Set(nodes.map(n => n.name)).size).toBe(30);
    expect(nodes.map(n => n.sealCost)).toEqual(prices);
    expect(nodes.reduce((sum, n) => sum + n.sealCost, 0)).toBe(6170);
    const unlocked = new Set<string>();
    for (const [i, n] of nodes.entries()) {
      expect(n.id).toBe(`elements-${String(i + 1).padStart(2, '0')}`);
      expect(n.index).toBe(i + 1);
      expect(n.branch).toBe('elements');
      expect(n.pointCost).toBe(1);
      expect(n.minLevel).toBe([1,5,9,13,17,21][Math.floor(i / 5)]);
      expect(n.requires).toEqual(i ? [nodes[i - 1].id] : []);
      expect(n.requires.every(id => unlocked.has(id))).toBe(true);
      unlocked.add(n.id);
      expect(n.description.length).toBeGreaterThan(15);
      expect(n.effects.length).toBeGreaterThanOrEqual((i + 1) % 5 === 0 ? 2 : 1);
    }
  });
  it('uses only permitted stats and explicit valid scopes, within even the unscoped budget', () => {
    const nodes = getKnowledge();
    for (const n of nodes) for (const e of n.effects) {
      expect(stats).toContain(e.stat);
      expect(Number.isFinite(e.value) && e.value > 0).toBe(true);
      expect(e.towers?.length).toBeGreaterThan(0);
      expect(e.towers?.every(t => towers.includes(t))).toBe(true);
      expect(new Set(e.towers).size).toBe(e.towers?.length);
    }
    for (const stat of stats) expect(total(nodes, stat)).toBeLessThanOrEqual(caps[stat]);
    for (const [i, tower] of towers.entries()) {
      expect(stats.map(stat => total(nodes, stat, tower))).toEqual(expected[i]);
    }
    for (const stat of stats) expect(total(nodes, stat, 'needle')).toBe(0);
  });
  it('every successive purchase changes at least one capped target stat', () => {
    const nodes = getKnowledge();
    for (let i = 0; i < nodes.length; i++) {
      const before = nodes.slice(0, i), after = nodes.slice(0, i + 1);
      expect(towers.some(t => stats.some(stat =>
        Math.min(caps[stat], total(after, stat, t)) > Math.min(caps[stat], total(before, stat, t))
      ))).toBe(true);
    }
  });
  it('returns independent mutable copies without contaminating another caller', () => {
    const first = getKnowledge();
    const original = getKnowledge();
    first[4].effects[0].towers!.pop();
    first[1].requires.length = 0;
    first[0].effects[0].value = 0;
    first.pop();
    expect(getKnowledge()).toEqual(original);
  });
  it('has 30 independent, local, distinct SVG resources', () => {
    const nodes = getKnowledge();
    const contents = nodes.map(n => {
      expect(n.icon).toBe(`art/knowledge/elements/${n.id}.svg`);
      const path = `public/${n.icon}`;
      expect(existsSync(path)).toBe(true);
      const svg = readFileSync(path, 'utf8');
      expect(svg).toMatch(/<svg\b[^>]*viewBox="0 0 64 64"/);
      expect(svg).not.toMatch(/<script|<image|<foreignObject|\b(?:href|onload)\s*=/i);
      return svg;
    });
    expect(new Set(contents).size).toBe(30);
  });
});
