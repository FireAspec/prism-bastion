import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import type {AttackDef,EffectDef,PathIndex,ResolvedTower,StatDelta,StatusSpec,Tiers,TowerDef} from '../../src/contracts';
import {legalTiers,canUpgrade,sellRefund,upgradeCost} from '../../src/contracts/rules';
import {getTower} from '../../src/content/towers/frost';

const artRoot=join(process.cwd(),'public/art/towers/frost');
const costs=[[225,450,1125,2700,6750],[275,550,1375,3300,8250],[250,500,1250,3000,7500]];

// Independent local test double for the frozen resolver rules. It is not installed as gameplay code.
function fixtureResolve(tower:TowerDef,tiers:Tiers):ResolvedTower {
  if(!legalTiers(tiers))throw new RangeError('illegal tier combination');
  const main=tiers.findIndex(t=>t>2)>=0?tiers.findIndex(t=>t>2):tiers.findIndex(t=>t>0);
  const mainPath=main<0?undefined:main as PathIndex;
  const attack={...tower.attack,statuses:tower.attack.statuses.map(s=>({...s}))};
  const replacements=mainPath===undefined?[]:tower.paths[mainPath].upgrades.slice(0,tiers[mainPath]).filter(u=>u.replaceAttack);
  const highest=replacements.at(-1)?.replaceAttack;
  if(highest)Object.assign(attack,structuredClone(highest));

  const statusByKind=new Map<string,StatusSpec>();
  function merge(s:StatusSpec){
    const prior=statusByKind.get(s.kind);
    if(!prior||s.power>prior.power||(s.power===prior.power&&s.duration>prior.duration))statusByKind.set(s.kind,{...s});
  }
  attack.statuses.forEach(merge);
  const effects=new Map<string,EffectDef>(tower.effects.map(e=>[e.id,{...e}]));
  const abilities=new Map(tower.abilities.map(a=>[a.id,{...a}]));
  const multiply:Partial<Record<keyof StatDelta,keyof AttackDef>>={
    damageMul:'damage',intervalMul:'interval',rangeMul:'range',shieldMultiplierMul:'shieldMultiplier',
    bossMultiplierMul:'bossMultiplier',projectileSpeedMul:'projectileSpeed',windupMul:'windup',
  };
  const additive:Partial<Record<keyof StatDelta,keyof AttackDef>>={
    pierceAdd:'pierce',countAdd:'count',splashAdd:'splash',chainsAdd:'chains',
    chainRadiusAdd:'chainRadius',armorPierceAdd:'armorPierce',executeBelowAdd:'executeBelow',
    pushAdd:'push',arcAdd:'arc',
  };
  for(let path=0;path<3;path++)for(const upgrade of tower.paths[path].upgrades.slice(0,tiers[path])){
    for(const [key,v] of Object.entries(upgrade.delta)){
      const stat=multiply[key as keyof StatDelta] ?? additive[key as keyof StatDelta];
      if(key==='detects'){attack.detects=Boolean(v);continue;}
      if(!stat)throw new Error('Unknown delta: '+key);
      const old=attack[stat] as number;
      (attack as unknown as Record<string,number>)[stat]=key in multiply?old*Number(v):old+Number(v);
    }
    upgrade.addStatuses?.forEach(merge);
    upgrade.effects?.forEach(e=>effects.set(e.id,{...e}));
    upgrade.abilities?.forEach(a=>abilities.set(a.id,{...a}));
  }
  attack.statuses=[...statusByKind.values()];
  const visual=mainPath===undefined?tower.visual:tower.paths[mainPath].upgrades[tiers[mainPath]-1].visual;
  const secondary=tiers.findIndex((v,i)=>i!==mainPath&&v>0);
  const overlay=mainPath!==undefined&&secondary>=0
    ?`/art/towers/frost/cross-${'abc'[mainPath]}-${'abc'[secondary]}.svg`:undefined;
  return {attack,effects:[...effects.values()],abilities:[...abilities.values()],visual:{...visual},mainPath,secondaryOverlay:overlay};
}

function allLegal():Tiers[]{
  const legal:Tiers[]=[];
  for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
    const levels:[number,number,number]=[a,b,c];if(legalTiers(levels))legal.push(levels);
  }
  return legal;
}

describe('Криокристалл: contract and independent data',()=>{
  it('provides a real, immediately useful base attack and fresh nested structures',()=>{
    const one=getTower(),other=getTower();
    expect([one.id,one.category,one.cost,one.placement,one.footprint]).toEqual(['frost','element',500,'land',26]);
    expect([one.attack.damage,one.attack.interval,one.attack.range]).toEqual([5,.9,155]);
    expect(one.attack.statuses).toContainEqual({kind:'slow',power:.24,duration:1.7});
    one.attack.statuses[0].power=999;one.paths[0].upgrades[0].name='mutated';one.paths[2].upgrades[4].abilities![0].power=0;
    expect(other.attack.statuses[0].power).toBe(.24);
    expect(other.paths[0].upgrades[0].name).toBe('Иней на гранях');
    expect(other.paths[2].upgrades[4].abilities![0].power).toBe(90);
  });

  it('has exactly 15 unique sequential upgrades with exact independent prices',()=>{
    const t=getTower();const ids=new Set<string>();
    expect(t.paths).toHaveLength(3);
    t.paths.forEach((p,path)=>{
      expect(p.upgrades).toHaveLength(5);
      p.upgrades.forEach((u,index)=>{
        expect(u.id).toBe(`frost-${'abc'[path]}${index+1}`);
        expect(ids.has(u.id)).toBe(false);ids.add(u.id);
        expect(u.tier).toBe(index+1);expect(u.cost).toBe(costs[path][index]);
        expect(u.cost).toBeGreaterThan(0);expect(u.name.length).toBeGreaterThan(5);
        expect(u.description.length).toBeGreaterThan(30);
        expect(u.cost).toBe(upgradeCost(500,[.9,1.1,1][path],u.tier));
        if(index<2)expect(u.replaceAttack).toBeUndefined();
        expect(u.visual.asset).toBe(`/art/towers/frost/${'abc'[path]}${index+1}.svg`);
      });
    });
    expect(ids.size).toBe(15);
  });

  it('keeps all numbers finite and nonnegative at every legal tier matrix entry',()=>{
    const t=getTower(),legal=allLegal();expect(legal.length).toBeGreaterThan(40);
    for(const tiers of legal){
      const resolved=fixtureResolve(t,tiers);
      const a=resolved.attack;
      for(const [name,val] of Object.entries(a)){
        if(typeof val==='number'){
          expect(Number.isFinite(val),`${tiers}: ${name}`).toBe(true);
          expect(val,`${tiers}: ${name}`).toBeGreaterThanOrEqual(0);
        }
      }
      expect(a.interval).toBeGreaterThanOrEqual(.05);
      expect(a.range).toBeGreaterThan(0);
      expect(a.damage).toBeGreaterThan(0);
      for(const s of a.statuses){expect(s.duration).toBeGreaterThan(0);expect(s.power).toBeGreaterThan(0);}
      expect(new Set(a.statuses.map(s=>s.kind)).size).toBe(a.statuses.length);
      for(const effect of resolved.effects){
        for(const value of Object.values(effect))if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);
      }
      expect(new Set(resolved.effects.map(e=>e.id)).size).toBe(resolved.effects.length);
      expect(new Set(resolved.abilities.map(a=>a.id)).size).toBe(resolved.abilities.length);
      expect(resolved.visual.asset.startsWith('/art/towers/frost/')).toBe(true);
      expect(existsSync(join(process.cwd(),'public',resolved.visual.asset))).toBe(true);
      if(resolved.secondaryOverlay)expect(existsSync(join(process.cwd(),'public',resolved.secondaryOverlay))).toBe(true);
    }
    for(const tiers of [[3,3,0],[1,1,1],[0,0,6],[5,2,1]] as Tiers[])
      expect(()=>fixtureResolve(t,tiers)).toThrow(RangeError);
  });

  it('retains specific T5 gameplay identities and six useful 5-2-0 crosses',()=>{
    const t=getTower();
    const a=fixtureResolve(t,[5,0,0]),b=fixtureResolve(t,[0,5,0]),c=fixtureResolve(t,[0,0,5]);
    expect([a.attack.mode,b.attack.mode,c.attack.mode]).toEqual(['pulse','splash','pulse']);
    expect([a.attack.element,b.attack.element,c.attack.element]).toEqual(['frost','kinetic','frost']);
    expect(a.attack.statuses.find(s=>s.kind==='freeze')?.duration).toBe(.45);
    expect(b.attack.count).toBe(3);expect(b.attack.armorPierce).toBe(8);expect(b.effects[0]).toMatchObject({kind:'echo',power:.5,cap:3});
    expect(c.attack.statuses.find(s=>s.kind==='slow')?.power).toBe(.55);
    expect(a.abilities[0]).toMatchObject({kind:'nova',power:100,cooldown:48});
    expect(c.abilities[0]).toMatchObject({kind:'nova',power:90,cooldown:40});
    const targets:Tiers[]=[[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
    const cross=targets.map(x=>fixtureResolve(t,x));
    expect(cross.map(x=>x.mainPath)).toEqual([0,0,1,1,2,2]);
    expect(cross.map(x=>x.secondaryOverlay)).toEqual([
      '/art/towers/frost/cross-a-b.svg','/art/towers/frost/cross-a-c.svg',
      '/art/towers/frost/cross-b-a.svg','/art/towers/frost/cross-b-c.svg',
      '/art/towers/frost/cross-c-a.svg','/art/towers/frost/cross-c-b.svg',
    ]);
    expect(cross[0].attack.damage).toBe(18.75);
    expect(cross[0].attack.interval).toBeCloseTo(.602);
    expect(cross[1].attack.range).toBeCloseTo(205*1.08*1.1*1.08);
    expect(cross[2].attack.interval).toBeCloseTo(.9*.86);
    expect(cross[3].attack.splash).toBe(64);
    expect(cross[4].attack.interval).toBeCloseTo(.68*.86);
    expect(cross[5].attack.damage).toBe(17.5);
    for(const tiers of targets){
      const spent=500+tiers.reduce((sum,n,i)=>sum+costs[i].slice(0,n).reduce((x,y)=>x+y,0),0);
      expect(spent).toBeGreaterThan(500);
      expect(sellRefund(spent)).toBeLessThan(spent);
    }
  });

  it('validates every upgrade edge in the entire finite state-space',()=>{
    for(const tiers of allLegal())for(const p of [0,1,2] as PathIndex[]){
      const next=[...tiers] as Tiers;next[p]++;
      expect(canUpgrade(tiers,p)).toBe(legalTiers(next));
    }
  });
});

describe('Криокристалл: SVG art assets',()=>{
  it('ships 16 independent full vector models, six transparent overlays and a preview',()=>{
    const names=['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(t=>`${p}${t}`))];
    const sources=names.map(n=>readFileSync(join(artRoot,n+'.svg'),'utf8'));
    expect(new Set(sources).size).toBe(16);
    for(const source of sources){
      expect(source).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(source).toContain('viewBox="0 0 240 240"');
      expect(source).toContain('<polygon');
      expect(source).toContain('</svg>');
      expect(source).not.toMatch(/<script|<text|<foreignObject|<image|href="https?:|url\(https?:/i);
    }
    for(const a of 'abc')for(const b of 'abc')if(a!==b){
      const overlay=readFileSync(join(artRoot,`cross-${a}-${b}.svg`),'utf8');
      expect(overlay).toContain('viewBox="0 0 240 240"');
      expect(overlay).not.toMatch(/<script|<text|<image|<foreignObject|href="https?:/i);
      expect(overlay).not.toContain('fill="#061421"');
    }
    const html=readFileSync(join(artRoot,'preview.html'),'utf8');
    for(const model of names)expect(html).toContain(`src="${model}.svg"`);
    for(const a of 'abc')for(const b of 'abc')if(a!==b)expect(html).toContain(`src="cross-${a}-${b}.svg"`);
    expect(html).toContain('lang="ru"');
  });
});
