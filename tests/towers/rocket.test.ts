import {describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {getTower} from '../../src/content/towers/rocket';
import {legalTiers,sellRefund} from '../../src/contracts/rules';
import type {AttackDef,AbilityDef,StatusSpec,Tiers,VisualState} from '../../src/contracts';

function fixture(t:Tiers) {
  if(!legalTiers(t)) throw new RangeError('Illegal tiers');
  const d=getTower();
  const paths=([0,1,2] as const).filter(p=>t[p]>0).sort((a,b)=>t[b]-t[a]||a-b);
  const main=paths[0], secondary=paths[1];
  let a:AttackDef=structuredClone(d.attack);
  if(main!==undefined && t[main]>=3) for(const u of d.paths[main].upgrades.slice(0,t[main])) if(u.replaceAttack) a=structuredClone(u.replaceAttack);
  const statuses=new Map<string,StatusSpec>(a.statuses.map(s=>[s.kind,s]));
  const abilities=new Map<string,AbilityDef>();
  for(const p of [0,1,2] as const) for(const u of d.paths[p].upgrades.slice(0,t[p])) {
    const x=u.delta;
    a.damage*=x.damageMul??1; a.interval*=x.intervalMul??1; a.range*=x.rangeMul??1;
    a.projectileSpeed*=x.projectileSpeedMul??1; a.splash+=x.splashAdd??0; a.count+=x.countAdd??0;
    a.armorPierce+=x.armorPierceAdd??0; a.shieldMultiplier*=x.shieldMultiplierMul??1; a.bossMultiplier*=x.bossMultiplierMul??1;
    for(const s of u.addStatuses??[]) {const old=statuses.get(s.kind);statuses.set(s.kind,old?{kind:s.kind,power:Math.max(old.power,s.power),duration:Math.max(old.duration,s.duration),maxStacks:Math.max(old.maxStacks??1,s.maxStacks??1)}:s);}
    for(const b of u.abilities??[]) abilities.set(b.id,b);
  }
  a.statuses=[...statuses.values()];
  const visual:VisualState=main===undefined?d.visual:d.paths[main].upgrades[t[main]-1].visual;
  const overlay=secondary===undefined?undefined:d.paths[secondary].upgrades[t[secondary]-1].visual.asset.replace(/\.svg$/,'-overlay.svg');
  return {a,visual,overlay,abilities:[...abilities.values()]};
}
const art='public/art/towers/rocket/';
const cost=(t:Tiers)=>getTower().cost+getTower().paths.reduce((sum,p,i)=>sum+p.upgrades.slice(0,t[i]).reduce((s,u)=>s+u.cost,0),0);
describe('rocket v1',()=>{
  it('base and 15 exact prices, unique ids and independent objects',()=>{
    const d=getTower(); expect([d.id,d.category,d.placement,d.cost,d.footprint,d.attack.damage,d.attack.interval,d.attack.range]).toEqual(['rocket','tech','land',1000,26,35,1.6,230]);
    expect(d.paths.map(p=>p.upgrades.map(u=>u.cost))).toEqual([[500,1000,2500,6000,15000],[575,1150,2875,6900,17250],[450,900,2250,5400,13500]]);
    const upgrades=d.paths.flatMap(p=>p.upgrades);
    expect(new Set(upgrades.map(u=>u.id)).size).toBe(15);expect(new Set(upgrades.map(u=>u.name)).size).toBe(15);
    for(const p of d.paths){expect(p.upgrades.map(u=>u.tier)).toEqual([1,2,3,4,5]);expect(p.upgrades.slice(0,2).every(u=>!u.replaceAttack)).toBe(true);}
    d.paths[0].upgrades[0].delta.damageMul=999;expect(getTower().paths[0].upgrades[0].delta.damageMul).toBe(1.1);
  });
  it('all 64 legal triples have finite positive attacks and existing assets',()=>{
    let n=0;
    for(let x=0;x<=5;x++)for(let y=0;y<=5;y++)for(let z=0;z<=5;z++){
      const t:Tiers=[x,y,z];if(!legalTiers(t)){expect(()=>fixture(t)).toThrow();continue;}n++;
      const r=fixture(t);expect(Object.values(r.a).filter(v=>typeof v==='number').every(Number.isFinite)).toBe(true);
      expect(r.a.damage).toBeGreaterThan(0);expect(r.a.interval).toBeGreaterThanOrEqual(.05);expect(r.a.count).toBeGreaterThanOrEqual(1);expect(r.a.count%1).toBe(0);
      expect(r.a.mode).toBe('splash');expect(r.a.homing).toBe(true);expect(r.a.splash).toBeGreaterThan(0);
      expect(readFileSync('public'+r.visual.asset,'utf8')).toContain('<svg');
      if(r.overlay)expect(readFileSync('public'+r.overlay,'utf8')).toContain('<svg');
      for(const s of r.a.statuses){expect(s.power).toBeGreaterThan(0);expect(s.duration).toBeGreaterThan(0);expect(s.maxStacks).toBeLessThanOrEqual(4);}
      expect(sellRefund(cost(t))).toBe(Math.floor(cost(t)*.7));
    }expect(n).toBe(64);
  });
  it('all six final combinations preserve primary visual and retain secondary mechanics',()=>{
    for(const p of [0,1,2] as const)for(const q of [0,1,2] as const){if(p===q)continue;
      const base:Tiers=[0,0,0];base[p]=5;const t:Tiers=[...base];t[q]=2;
      const r=fixture(t), b=fixture(base);
      expect(r.visual.asset).toBe(b.visual.asset);expect(r.overlay).toBe('/art/towers/rocket/'+'abc'[q]+'2-overlay.svg');
      expect(r.a.element).toBe(p===2?'fire':'kinetic');
      if(q===0){expect(r.a.interval).toBeCloseTo(b.a.interval*.82);expect(r.a.splash).toBe(b.a.splash+10);}
      if(q===1){expect(r.a.armorPierce).toBe(b.a.armorPierce+8);expect(r.a.shieldMultiplier).toBeCloseTo(b.a.shieldMultiplier*1.55);}
      if(q===2){expect(r.a.range).toBeCloseTo(b.a.range*1.14);expect(r.a.statuses.some(s=>s.kind==='burn')).toBe(true);}
    }
  });
  it('final tiers change mechanics, and bounded burn or abilities are meaningful',()=>{
    expect(fixture([5,0,0]).a.count).toBe(9);expect(fixture([5,0,0]).abilities[0].kind).toBe('overclock');
    expect(fixture([0,5,0]).a.count).toBe(3);expect(fixture([0,5,0]).a.armorPierce).toBe(54);
    expect(fixture([0,5,0]).a.shieldMultiplier).toBeCloseTo(2.48);
    expect(fixture([0,0,5]).a.count).toBe(5);expect(fixture([0,0,5]).a.statuses).toEqual([{kind:'burn',power:75,duration:6,maxStacks:4}]);
    expect(fixture([0,0,5]).abilities[0].kind).toBe('meteor');
    const d=getTower();expect(d.effects).toEqual([]);expect(d.paths.flatMap(p=>p.upgrades).every(u=>!u.effects?.length)).toBe(true);
  });
  it('ships 22 self-contained distinct SVGs and preview with six final combinations',()=>{
    const names=['base.svg',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(n=>p+n+'.svg')),...['a','b','c'].flatMap(p=>[1,2].map(n=>p+n+'-overlay.svg'))];
    expect(readdirSync(art).filter(n=>n.endsWith('.svg')).sort()).toEqual([...names].sort());
    const contents=names.map(n=>readFileSync(art+n,'utf8'));
    expect(new Set(contents).size).toBe(22);
    for(const svg of contents){expect(svg).toContain('viewBox="0 0 128 128"');expect(svg).not.toMatch(/<(script|text|image|foreignObject)\b/i);expect(svg.replace('http://www.w3.org/2000/svg','')).not.toMatch(/https?:\/\//);}
    const html=readFileSync(art+'preview.html','utf8');for(const p of 'ABC')for(const q of 'ABC')if(p!==q)expect(html).toContain(p+'5 + '+q+'2');
  });
});
