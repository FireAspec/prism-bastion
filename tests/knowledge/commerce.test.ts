import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { getKnowledge } from '../../src/content/knowledge/commerce';
import type { KnowledgeStat } from '../../src/contracts';

const caps: Partial<Record<KnowledgeStat, number>> = { startingCash: 1000, passiveIncome: 1500, purchaseDiscount: 400, xpGain: 500, sealGain: 500 };
const incomeTowers = ['mint','bank','orchard','harbor'];
const totals = (count: number, tower?: string) => {
  const result: Partial<Record<KnowledgeStat, number>> = {};
  for (const node of getKnowledge().slice(0,count)) for (const e of node.effects) {
    if (tower && e.towers && !e.towers.includes(tower)) continue;
    result[e.stat] = (result[e.stat] ?? 0) + Math.round(e.value * 10000);
  }
  return result;
};

describe('commerce doctrine', () => {
  it('has 30 unique sequential nodes, exact prerequisites and progression costs', () => {
    const nodes = getKnowledge();
    expect(nodes).toHaveLength(30);
    expect(new Set(nodes.map(n => n.id)).size).toBe(30);
    expect(new Set(nodes.map(n => n.name)).size).toBe(30);
    const costs = [30,35,40,50,55,65,75,85,95,105,120,130,145,160,170,190,205,220,240,255,275,295,315,335,355,380,400,425,450,470];
    nodes.forEach((n,i) => {
      expect(n.id).toBe('commerce-'+String(i+1).padStart(2,'0'));
      expect(n.index).toBe(i+1);
      expect(n.branch).toBe('commerce');
      expect(n.requires).toEqual(i ? [nodes[i-1].id] : []);
      expect(n.minLevel).toBe([1,5,9,13,17,21][Math.floor(i/5)]);
      expect(n.pointCost).toBe(1);
      expect(n.sealCost).toBe(costs[i]);
      expect(n.description.length).toBeGreaterThan(10);
    });
    expect(nodes.reduce((s,n)=>s+n.sealCost,0)).toBe(6170);
  });
  it('uses only economic stats, valid scopes, nonzero increments and milestone effects', () => {
    const nodes = getKnowledge();
    nodes.forEach((n,i)=>{
      expect(n.effects.length).toBeGreaterThanOrEqual(i%5===4?2:1);
      for(const e of n.effects){
        expect(caps[e.stat]).toBeDefined();
        expect(Number.isFinite(e.value) && e.value>0).toBe(true);
        if(e.towers){
          expect(e.stat).toBe('passiveIncome');
          expect(e.towers.length).toBeGreaterThan(0);
          expect(new Set(e.towers).size).toBe(e.towers.length);
          expect(e.towers.every(t=>incomeTowers.includes(t))).toBe(true);
        }
      }
      const useful = [undefined,...incomeTowers].some(t=>{
        const before=totals(i,t),after=totals(i+1,t);
        return Object.entries(after).some(([s,v])=>Math.min(v,caps[s as KnowledgeStat]!)>Math.min(before[s as KnowledgeStat]??0,caps[s as KnowledgeStat]!));
      });
      expect(useful).toBe(true);
    });
    expect(totals(30)).toEqual(caps);
    expect(incomeTowers.map(t=>totals(30,t).passiveIncome)).toEqual([1200,1075,900,775]);
    expect(totals(30,'needle').passiveIncome).toBe(475);
  });
  it('matches early, middle and full economic profiles',()=>{
    expect(totals(5)).toEqual({"startingCash":200,"passiveIncome":250,"purchaseDiscount":25,"xpGain":50,"sealGain":0});
    expect(totals(15)).toEqual({"startingCash":475,"passiveIncome":675,"purchaseDiscount":180,"xpGain":160,"sealGain":0});
    expect(totals(30)).toEqual({"startingCash":1000,"passiveIncome":1500,"purchaseDiscount":400,"xpGain":500,"sealGain":500});
    expect(Math.floor(900*(1+totals(30).startingCash!/10000))).toBe(990);
    expect(Math.ceil(1000*(1-totals(30).purchaseDiscount!/10000))).toBe(960);
    expect(Math.floor(960*.7)).toBe(672);
  });
  it('returns independent data and 30 unique self-contained icons',()=>{
    const a=getKnowledge(); a[0].effects[0].value=99; a[1].requires.length=0; a[2].effects[0].towers!.push('invalid');
    const b=getKnowledge(); expect(b[0].effects[0].value).toBe(.01);expect(b[1].requires).toHaveLength(1);expect(b[2].effects[0].towers).not.toContain('invalid');
    const icons=b.map(n=>n.icon); expect(new Set(icons).size).toBe(30);
    for(const icon of icons){const file='public/'+icon;expect(existsSync(file)).toBe(true);const svg=readFileSync(file,'utf8');expect(svg).toMatch(/<svg[^>]*viewBox=/);expect(svg).not.toMatch(/<script|<image|href=/i);}
  });
});
