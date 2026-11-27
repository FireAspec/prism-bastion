import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getKnowledge } from '../../src/content/knowledge/lighthouse';
import type { KnowledgeEffect, KnowledgeStat } from '../../src/contracts';

const budget: Partial<Record<KnowledgeStat, number>> = {
  lives: 20, waterDamage: .15, waterRange: .10, controlDuration: .05,
  revealRadius: .07, bossDamage: .06, xpGain: .05, sealGain: .05,
};
const towers = ['needle','cannon','rail','scatter','saw','ember','frost','tesla','venom','prism',
  'mortar','rocket','drone','mine','resonator','chrono','gravity','mirror','portal','storm',
  'beacon','forge','observatory','mint','bank','orchard','harbor','tide','coral','bastion'];
const water = ['harbor','tide','coral'];
const eligible = (effect: KnowledgeEffect, tower: string) =>
  (!effect.towers || effect.towers.includes(tower)) &&
  (!effect.stat.startsWith('water') || water.includes(tower));
const sum = (effects: KnowledgeEffect[], stat: KnowledgeStat, tower?: string) =>
  effects.filter(e => e.stat === stat && (!tower || eligible(e, tower)))
    .reduce((a, e) => a + e.value, 0);
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('complete, linear, uniquely identified and affordable in the specified schedule', () => {
  const nodes = getKnowledge();
  assert.equal(nodes.length, 30);
  for (const field of ['id','name','description','icon'] as const) {
    assert.equal(new Set(nodes.map(n => n[field])).size, 30);
  }
  const prices = [30,35,40,50,55,65,75,85,95,105,120,130,145,160,170,
    190,205,220,240,255,275,295,315,335,355,380,400,425,450,470];
  // Check the complete sequence against the contract's formula, plus fixed boundary values.
  nodes.forEach((node, i) => {
    const n = i + 1;
    assert.equal(node.id, `lighthouse-${String(n).padStart(2,'0')}`);
    assert.equal(node.index, n);
    assert.equal(node.branch, 'lighthouse');
    assert.deepEqual(node.requires, i ? [nodes[i-1].id] : []);
    assert.equal(node.minLevel, 1 + 4 * Math.floor(i / 5));
    assert.equal(node.pointCost, 1);
    assert.equal(node.sealCost, prices[i]);
    assert.ok(node.effects.length >= (n % 5 === 0 ? 2 : 1));
  });
  assert.equal(nodes.reduce((a,n) => a+n.sealCost,0),6170);
});

test('every effect is legal and total budget remains safe even before scope filtering', () => {
  const effects = getKnowledge().flatMap(n => n.effects);
  for (const e of effects) {
    assert.ok(Object.hasOwn(budget,e.stat));
    assert.ok(Number.isFinite(e.value) && e.value > 0);
    if (e.stat === 'lives') assert.ok(Number.isInteger(e.value));
    if (e.towers) {
      assert.ok(e.towers.length > 0 && new Set(e.towers).size === e.towers.length);
      assert.ok(e.towers.every(t => towers.includes(t)));
      assert.ok(e.towers.some(t => eligible(e,t)));
      assert.ok(!['lives','xpGain','sealGain'].includes(e.stat));
      if(e.stat.startsWith('water')) assert.ok(e.towers.every(t => water.includes(t)));
    }
  }
  for (const [stat, cap] of Object.entries(budget)) {
    near(sum(effects,stat as KnowledgeStat),cap);
    for (const t of towers) assert.ok(sum(effects,stat as KnowledgeStat,t) <= cap + 1e-9);
  }
});

test('each prefix adds at least one effective bonus, including with other doctrines at their allocated cap', () => {
  const globalCaps = {...budget, bossDamage:.12, controlDuration:.10, revealRadius:.15, xpGain:.10, sealGain:.10};
  let prior: KnowledgeEffect[] = [];
  for (const node of getKnowledge()) {
    const next = [...prior,...node.effects];
    assert.ok(node.effects.some(e => towers.some(t => {
      if (!eligible(e,t)) return false;
      const cap = globalCaps[e.stat as keyof typeof globalCaps]!;
      const reserve = cap - budget[e.stat]!;
      return Math.min(cap,reserve + sum(next,e.stat,t)) > Math.min(cap,reserve + sum(prior,e.stat,t)) + 1e-9;
    })), node.id);
    prior = next;
  }
});

test('scoped full-profile totals and reward bonuses match independent expected examples', () => {
  const e = getKnowledge().flatMap(n=>n.effects);
  for (const [id,damage,range] of [['harbor',.05,.08],['tide',.07,.06],['coral',.07,.08]] as const) {
    near(sum(e,'waterDamage',id),damage);
    near(sum(e,'waterRange',id),range);
  }
  near(sum(e,'waterDamage','cannon'),0);
  near(sum(e,'controlDuration','frost'),.05);
  near(sum(e,'controlDuration','tesla'),.03);
  near(sum(e,'revealRadius','observatory'),.07);
  near(sum(e,'revealRadius','beacon'),.05);
  near(sum(e,'revealRadius','mirror'),.03);
  near(sum(e,'lives'),20);
  near(sum(e,'xpGain'),.05);
  near(sum(e,'sealGain'),.05);
});

test('catalog callers cannot mutate any other catalog instance', () => {
  const a = getKnowledge();
  const original = getKnowledge();
  a[1].requires.push('invalid');
  a[1].effects[0].towers!.push('invalid');
  a[0].effects[0].value = 999;
  a[0].name = 'invalid';
  a.pop();
  assert.deepEqual(getKnowledge(),original);
});

test('each node has a distinct, local and standalone SVG pictogram', () => {
  const files = getKnowledge().map(n => {
    assert.equal(n.icon,`/art/knowledge/lighthouse/${n.id}.svg`);
    const svg = readFileSync(`public${n.icon}`,'utf8');
    assert.match(svg, /viewBox="0 0 64 64"/);
    assert.ok(svg.includes(`<title>${n.name}</title>`));
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|\bhref\s*=|\bon\w+\s*=/i);
    return [...svg.matchAll(/<path d="([^"]+)"/g)].at(-1)![1];
  });
  assert.equal(new Set(files).size,30);
});
