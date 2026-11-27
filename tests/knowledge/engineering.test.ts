import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getKnowledge } from '../../src/content/knowledge/engineering.ts';
import type { KnowledgeStat } from '../../src/contracts';
const towers = 'needle cannon rail scatter saw ember frost tesla venom prism mortar rocket drone mine resonator chrono gravity mirror portal storm beacon forge observatory mint bank orchard harbor tide coral bastion'.split(' ');
const caps = { supportRadius: .12, abilityCooldown: .12, revealRadius: .07, purchaseDiscount: .04 } as const;
const stats = Object.keys(caps) as (keyof typeof caps)[];
const nodes = getKnowledge();
function bonus(tower: string, stat: KnowledgeStat, count = 30): number {
  return nodes.slice(0, count).flatMap(n => n.effects)
    .filter(e => e.stat === stat && (!e.towers || e.towers.includes(tower)))
    .reduce((sum, e) => sum + e.value, 0);
}
function close(actual: number, expected: number): void { assert.ok(Math.abs(actual - expected) < 1e-9); }
test('30 unique ordered nodes and canonical progression', () => {
  assert.equal(nodes.length, 30);
  assert.equal(new Set(nodes.map(n => n.name)).size, 30);
  assert.equal(new Set(nodes.map(n => n.id)).size, 30);
  assert.equal(nodes.reduce((s,n) => s+n.sealCost,0), 6170);
  for (const [i,n] of nodes.entries()) {
    assert.equal(n.id, 'engineering-'+String(i+1).padStart(2,'0'));
    assert.equal(n.index, i+1); assert.equal(n.branch, 'engineering');
    assert.deepEqual(n.requires, i ? [nodes[i-1].id] : []);
    assert.equal(n.pointCost, 1); assert.equal(n.minLevel, 1+4*Math.floor(i/5));
    assert.equal(n.sealCost, Math.ceil((20+5*(i+1)+(i+1)**2/3)/5)*5);
    assert.ok(n.description.length > 15);
    assert.ok(n.effects.length >= ((i+1)%5===0 ? 2 : 1));
  }
});
test('valid positive effects, meaningful scopes and no wasted nodes under budget', () => {
  for (const [i,n] of nodes.entries()) {
    for (const e of n.effects) {
      assert.ok(stats.includes(e.stat as keyof typeof caps));
      assert.ok(Number.isFinite(e.value) && e.value > 0);
      if (e.stat === 'purchaseDiscount') assert.equal(e.towers, undefined);
      else { assert.ok(e.towers && e.towers.length); assert.equal(new Set(e.towers).size, e.towers.length); assert.ok(e.towers.every(t => towers.includes(t))); }
      assert.ok(towers.some(t => (!e.towers || e.towers.includes(t)) && bonus(t,e.stat,i+1)>bonus(t,e.stat,i)));
    }
    for (const t of towers) for (const s of stats) assert.ok(bonus(t,s,i+1) <= caps[s]+1e-9);
  }
});
test('early, intermediate and final values match design checkpoints', () => {
  close(bonus('beacon','supportRadius',5), .03);
  close(bonus('beacon','revealRadius',5), .015);
  close(bonus('forge','abilityCooldown',15), .04);
  close(bonus('beacon','supportRadius'), .10);
  close(bonus('observatory','revealRadius'), .065);
  close(bonus('forge','abilityCooldown'), .08);
  close(bonus('needle','purchaseDiscount'), .038);
  close(bonus('needle','supportRadius'), 0);
  close(bonus('needle','abilityCooldown'), 0);
  close(bonus('needle','revealRadius'), 0);
  // Contract examples with explicit fixtures, not an engine integration test.
  close(160*(1+bonus('beacon','supportRadius')),176);
  close(30*(1-bonus('forge','abilityCooldown')),27.6);
  assert.equal(Math.ceil(1000*(1-bonus('needle','purchaseDiscount'))),962);
  assert.equal(Math.floor(962*.7),673);
});
test('catalog calls do not share nested mutable data', () => {
  const copy = getKnowledge(); copy[1].requires.push('bad'); copy[0].effects[0].towers?.push('bad'); copy[0].effects[0].value=99;
  assert.deepEqual(getKnowledge(), nodes);
});
test('all icons are present, distinct and self-contained', () => {
  const images = nodes.map(n => {
    assert.equal(n.icon, '/art/knowledge/engineering/'+n.id+'.svg');
    const svg=readFileSync('public'+n.icon,'utf8');
    assert.match(svg, /<svg\b/); assert.match(svg, /viewBox="0 0 72 72"/);
    assert.ok(svg.includes('<title>'+n.name+'</title>'));
    assert.doesNotMatch(svg, /<(script|image|foreignObject)\b|\b(?:href|onload)=/i);
    return svg.match(/<path d="([^"]+)" fill="none"/)?.[1];
  });
  assert.ok(images.every(Boolean)); assert.equal(new Set(images).size,30);
});
