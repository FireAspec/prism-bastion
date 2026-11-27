import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {legalTiers,canUpgrade,upgradeCost} from '../../src/contracts/rules';
import type {AttackDef,EffectDef,PathIndex,ResolvedTower,StatusSpec,Tiers,TowerDef,UpgradeDef} from '../../src/contracts';
import {getTower} from '../../src/content/towers/gravity';

const asset = (file:string) => fileURLToPath(new URL('../../public/art/towers/gravity/'+file,import.meta.url));
const costs = [[660,1320,3300,7920,19800],[600,1200,3000,7200,18000],[570,1140,2850,6840,17100]];
const cross:Tiers[] = [[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];

// A fixture for the frozen resolution rules. The combat module is intentionally not imported:
// on the base commit it is a stub owned by another feature branch.
function resolveFixture(def:TowerDef,tiers:Tiers):ResolvedTower {
  if(!legalTiers(tiers))throw new RangeError('illegal tiers');
  const contenders = ([0,1,2] as PathIndex[]).filter(p=>tiers[p]>0);
  const main = contenders.sort((x,y)=>tiers[y]-tiers[x]||x-y)[0];
  let attack:AttackDef = structuredClone(def.attack);
  if(main!==undefined)for(let t=0;t<tiers[main];t++){
    const replacement=def.paths[main].upgrades[t].replaceAttack;
    if(replacement)attack=structuredClone(replacement);
  }
  const effects:EffectDef[]=structuredClone(def.effects);
  const abilities=structuredClone(def.abilities);
  function mergeStatuses(incoming:StatusSpec[]) {
    for(const status of incoming){
      const idx=attack.statuses.findIndex(s=>s.kind===status.kind);
      if(idx>=0){
        const prior=attack.statuses[idx];
        attack.statuses[idx]={kind:status.kind,power:Math.max(prior.power,status.power),
          duration:Math.max(prior.duration,status.duration),maxStacks:Math.max(prior.maxStacks??1,status.maxStacks??1)};
      }
      else attack.statuses.push(structuredClone(status));
    }
  }
  for(let p=0;p<3;p++)for(let i=0;i<tiers[p];i++){
    const u=def.paths[p].upgrades[i];
    const d=u.delta;
    attack.damage*=d.damageMul??1;
    attack.interval*=d.intervalMul??1;
    attack.range*=d.rangeMul??1;
    attack.pierce+=d.pierceAdd??0;
    attack.count+=d.countAdd??0;
    attack.splash+=d.splashAdd??0;
    attack.chains+=d.chainsAdd??0;
    attack.chainRadius+=d.chainRadiusAdd??0;
    attack.armorPierce+=d.armorPierceAdd??0;
    attack.shieldMultiplier*=d.shieldMultiplierMul??1;
    attack.bossMultiplier*=d.bossMultiplierMul??1;
    attack.executeBelow+=d.executeBelowAdd??0;
    attack.push+=d.pushAdd??0;
    attack.projectileSpeed*=d.projectileSpeedMul??1;
    attack.windup*=d.windupMul??1;
    attack.arc+=d.arcAdd??0;
    if(d.detects)attack.detects=true;
    if(u.addStatuses)mergeStatuses(u.addStatuses);
    for(const eff of u.effects??[]){
      const at=effects.findIndex(e=>e.id===eff.id);
      if(at>=0)effects[at]=structuredClone(eff); else effects.push(structuredClone(eff));
    }
    for(const ab of u.abilities??[]){
      const at=abilities.findIndex(a=>a.id===ab.id);
      if(at>=0)abilities[at]=structuredClone(ab); else abilities.push(structuredClone(ab));
    }
  }
  const secondary=contenders.find(p=>p!==main);
  return {
    attack,effects,abilities,
    visual:main===undefined?structuredClone(def.visual):
      structuredClone(def.paths[main].upgrades[tiers[main]-1].visual),
    ...(main===undefined?{}:{mainPath:main}),
    ...(secondary===undefined?{}:{secondaryOverlay:
      '/art/towers/gravity/'+(['a','b','c'][secondary])+
      tiers[secondary]+'-overlay.svg'}),
  };
}

function allNumbersFinite(value:unknown):boolean {
  if(typeof value==='number')return Number.isFinite(value);
  if(Array.isArray(value))return value.every(allNumbersFinite);
  if(value&&typeof value==='object')return Object.values(value).every(allNumbersFinite);
  return true;
}
function invested(def:TowerDef,tiers:Tiers):number {
  return def.cost+tiers.reduce((sum,tier,p)=>sum+
    def.paths[p].upgrades.slice(0,tier).reduce((cost,u)=>cost+u.cost,0),0);
}

describe('gravity catalog data',()=>{
  it('has one independent land tech base with all mandatory attack fields',()=>{
    const def=getTower();
    expect([def.id,def.category,def.placement,def.cost,def.footprint]).toEqual(['gravity','tech','land',1200,26]);
    expect([def.attack.damage,def.attack.interval,def.attack.range]).toEqual([20,1.5,175]);
    expect(def.paths).toHaveLength(3);
    def.attack.damage=999;
    def.paths[0].upgrades[0].delta.rangeMul=999;
    expect(getTower().attack.damage).toBe(20);
    expect(getTower().paths[0].upgrades[0].delta.rangeMul).toBe(1.08);
  });
  it('has precisely fifteen ordered purchases with immutable IDs and exact normal prices',()=>{
    const def=getTower(),ids=new Set<string>();
    def.paths.forEach((path,p)=>{
      expect(path.upgrades).toHaveLength(5);
      path.upgrades.forEach((u,i)=>{
        expect(u.id).toBe('gravity-'+['a','b','c'][p]+(i+1));
        expect(ids.has(u.id)).toBe(false);
        ids.add(u.id);
        expect(u.tier).toBe(i+1);
        expect(u.cost).toBe(costs[p][i]);
        expect(upgradeCost(1200,[1.1,1,.95][p],u.tier)).toBe(u.cost);
        expect(u.name.length).toBeGreaterThan(4);
        expect(u.description.length).toBeGreaterThan(30);
        expect(Object.values(u.delta).some(v=>v!==0&&v!==1)||u.effects||u.replaceAttack).toBeTruthy();
      });
    });
    expect(ids.size).toBe(15);
  });
  it('keeps every legal state finite and all illegal states rejected',()=>{
    const def=getTower();
    let legal=0;
    for(let a=0;a<=5;a++)for(let b=0;b<=5;b++)for(let c=0;c<=5;c++){
      const tiers:Tiers=[a,b,c];
      if(!legalTiers(tiers)){expect(()=>resolveFixture(def,tiers)).toThrow();continue;}
      legal++;
      const resolved=resolveFixture(def,tiers);
      expect(allNumbersFinite(resolved)).toBe(true);
      expect(resolved.attack.interval).toBeGreaterThanOrEqual(.05);
      expect(resolved.attack.damage).toBeGreaterThan(0);
      expect(resolved.attack.range).toBeGreaterThan(0);
      expect(resolved.attack.executeBelow).toBeLessThanOrEqual(.5);
      expect(resolved.effects.length).toBeLessThanOrEqual(1);
      expect(new Set(resolved.effects.map(e=>e.id)).size).toBe(resolved.effects.length);
      expect(invested(def,tiers)).toBeGreaterThanOrEqual(1200);
      for(const p of [0,1,2] as PathIndex[]){
        const next:Tiers=[...tiers];next[p]++;
        expect(canUpgrade(tiers,p)).toBe(legalTiers(next));
      }
    }
    expect(legal).toBe(1+3*5+3*(2*2+2*3*2));
  });
  it('keeps the branch identities mechanically distinct at T5',()=>{
    const def=getTower();
    const a=resolveFixture(def,[5,0,0]),b=resolveFixture(def,[0,5,0]),c=resolveFixture(def,[0,0,5]);
    expect(a.attack.mode).toBe('ring');
    expect(a.attack.windup).toBeGreaterThan(0);
    expect(a.attack.statuses.find(s=>s.kind==='slow')?.power).toBe(.58);
    expect(a.effects).toEqual([expect.objectContaining({kind:'portal',power:68,interval:2.7})]);
    expect(a.abilities[0]).toEqual(expect.objectContaining({kind:'nova',power:310,cooldown:55}));
    expect(b.attack.mode).toBe('pulse');
    expect(b.attack.windup).toBeGreaterThan(0);
    expect(b.attack.push).toBe(112); // 72 base + 10 + 12 + 18
    expect(b.attack.statuses.find(s=>s.kind==='stun')?.duration).toBe(.28);
    expect(b.abilities[0]).toEqual(expect.objectContaining({kind:'rewind',power:100}));
    expect(c.attack.mode).toBe('beam');
    expect(c.attack.executeBelow).toBeCloseTo(.45);
    expect(c.attack.bossMultiplier).toBeCloseTo(2.15*1.25*1.25*1.1);
    expect(c.effects[0]).toEqual(expect.objectContaining({kind:'focus',power:.13,cap:.9}));
    expect(c.abilities[0]).toEqual(expect.objectContaining({kind:'meteor',power:650}));
  });
  it('keeps T1 and T2 useful in mixed builds without replacing the main attack',()=>{
    const def=getTower();
    const black=resolveFixture(def,[5,2,0]);
    expect(black.attack.mode).toBe('ring');
    expect(black.attack.push).toBe(10);
    expect(black.attack.shieldMultiplier).toBeCloseTo(1.25);
    const reflect=resolveFixture(def,[2,5,0]);
    expect(reflect.attack.mode).toBe('pulse');
    expect(reflect.attack.statuses.find(s=>s.kind==='slow')?.power).toBe(.25);
    const lunar=resolveFixture(def,[0,2,5]);
    expect(lunar.attack.mode).toBe('beam');
    expect(lunar.attack.interval).toBeLessThan(resolveFixture(def,[0,0,5]).attack.interval);
  });
  it('defines a distinct local attack visual for each tier and base',()=>{
    const def=getTower();
    const visuals=[def.visual,...def.paths.flatMap(p=>p.upgrades.map(u=>u.visual))];
    for(const key of ['muzzle','projectile','impact'] as const){
      expect(new Set(visuals.map(v=>v[key])).size).toBe(16);
      for(const v of visuals)expect(v[key]).toMatch(/^gravity-(base|[abc][1-5])-[a-z]+$/);
    }
    expect(visuals[5].projectile).toContain('ring');
    expect(visuals[10].projectile).toContain('pulse');
    expect(visuals[15].projectile).toContain('beam');
  });
  it('resolves all six final cross paths and exposes the matching secondary overlay',()=>{
    const def=getTower();
    for(const tiers of cross){
      const result=resolveFixture(def,tiers);
      const primary=tiers.indexOf(5);
      const secondary=tiers.findIndex((n,i)=>i!==primary&&n===2);
      expect(result.mainPath).toBe(primary);
      expect(result.visual.asset).toBe('/art/towers/gravity/'+['a','b','c'][primary]+'5.svg');
      expect(result.secondaryOverlay).toBe('/art/towers/gravity/'+['a','b','c'][secondary]+'2-overlay.svg');
      expect(existsSync(asset(result.secondaryOverlay!.split('/').at(-1)!))).toBe(true);
      expect(invested(def,tiers)).toBeGreaterThan(30000);
    }
  });
});

describe('gravity vector assets',()=>{
  it('contains sixteen complete models, six overlays and a complete standalone gallery',()=>{
    const expected=['base',...['a','b','c'].flatMap(p=>[1,2,3,4,5].map(i=>p+i))];
    for(const file of expected){
      const svg=readFileSync(asset(file+'.svg'),'utf8');
      expect(svg).toMatch(/<svg[^>]+viewBox="0 0 128 128"/);
      expect(svg).toMatch(/<path|<circle|<polygon|<ellipse/);
      expect(svg).not.toMatch(/<script|<foreignObject|<text(?:\s|>)|(?:href|src)="https?:\/\/|xlink:href/i);
      expect(svg).toContain('</svg>');
    }
    for(const p of ['a','b','c'])for(const t of [1,2]){
      const svg=readFileSync(asset(p+t+'-overlay.svg'),'utf8');
      expect(svg).toContain('viewBox="0 0 128 128"');
      expect(svg).not.toMatch(/<script|<foreignObject|<text(?:\s|>)|(?:href|src)="https?:\/\//i);
    }
    const html=readFileSync(asset('preview.html'),'utf8');
    for(const name of expected)expect(html).toContain('src="'+name+'.svg"');
    for(const p of ['a','b','c'])expect(html).toContain('src="'+p+'2-overlay.svg"');
    expect((html.match(/class="card" data-path=/g)||[]).length).toBe(21);
  });
});
