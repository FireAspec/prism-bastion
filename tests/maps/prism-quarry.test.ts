import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getMap} from '../../src/content/maps/prism-quarry';
import {distance,pointInPolygon} from '../../src/contracts/geometry';
import {analyzeMap,SITES,siteFits} from '../../validation/maps/prism-quarry/geometry';
import {REPLAY_PLANS,FIRST_ARRIVAL_TOWERS,placementBudgetFloor,validateReplayPlan} from '../../validation/maps/prism-quarry/replay';

describe('Prism Quarry',()=>{
 const map=getMap();
 it('exports chapter 13 with two independent visible exits and stable data copies',()=>{
  expect(map).toMatchObject({id:'prism-quarry',difficulty:3,campaignIndex:13,recommendedDifficulty:'hard',theme:'foundry',pathWidth:44});
  expect(map.lanes).toHaveLength(2);
  expect(map.lanes[0].at(-1)).toEqual({x:1246,y:283});
  expect(map.lanes[1].at(-1)).toEqual({x:1246,y:469});
  const copy=getMap();copy.lanes[0][0].x=500;
  expect(getMap().lanes[0][0].x).toBe(32);
 });
 it('has legal land/water/corridor shapes, no zero segments, 3+ tactical cross-lane pads',()=>{
  const report=analyzeMap();
  expect(report.errors).toEqual([]);
  expect(report.laneLengths[0]).toBeGreaterThan(report.laneLengths[1]*1.2);
  expect(report.fastestTravelSeconds[1]).toBeGreaterThan(9);
  expect(report.geometricChecks.checkedPolygons).toBe(8);
  expect(report.geometricChecks.dualLanePositions).toEqual(expect.arrayContaining(['saddle','hinge','gate']));
  expect(SITES.every(s=>siteFits(map,s))).toBe(true);
 });
 it('independently samples both routes and tower circumferences against forbidden terrain',()=>{
  const forbidden=[...map.blocked,...map.water];
  for(const lane of map.lanes)for(let i=1;i<lane.length;i++){
   const a=lane[i-1],b=lane[i];expect(distance(a,b)).toBeGreaterThan(45);
   for(let t=0;t<=25;t++){
    const p={x:a.x+(b.x-a.x)*t/25,y:a.y+(b.y-a.y)*t/25};
    expect(p.x).toBeGreaterThanOrEqual(22);expect(p.x).toBeLessThanOrEqual(1258);
    expect(p.y).toBeGreaterThanOrEqual(22);expect(p.y).toBeLessThanOrEqual(698);
    expect(forbidden.some(poly=>pointInPolygon(p,poly))).toBe(false);
   }
  }
  for(const site of SITES)for(let i=0;i<32;i++){
   const angle=i*Math.PI/16;
   const p={x:site.pos.x+site.radius*Math.cos(angle),y:site.pos.y+site.radius*Math.sin(angle)};
   if(site.placement==='land')expect(forbidden.some(poly=>pointInPolygon(p,poly))).toBe(false);
   else expect(map.water.some(poly=>pointInPolygon(p,poly))).toBe(true);
  }
 });
 it('announces timed, valid, staggered lane groups without changing boss schedule or rewards',()=>{
  const enemies=new Set(['scarlet','amber','lemon','jade','azure','violet','iron','glass','cloak','regrow','shield',
   'split','ruby','glacier','copper','obsidian','dart','swarm','aegis','royal','hollow','prismatic','juggernaut','herald']);
  const indices=Object.keys(map.waveOverrides).map(Number);
  expect(indices.length).toBeGreaterThanOrEqual(30);
  for(const boss of [10,20,40,60,80,100])expect(indices).not.toContain(boss);
  for(const override of Object.values(map.waveOverrides)){
   expect(override).not.toHaveProperty('reward');
   expect(override.preview).toContain('Север / длинная');
   const groups=override.groups??[];
   for(const group of groups){
    expect(enemies.has(group.enemy)).toBe(true);
    expect([0,1]).toContain(group.lane);
    expect(group.at).toBeGreaterThanOrEqual(1);
    expect(group.every).toBeGreaterThan(0);
    expect(group.count).toBeGreaterThan(0);
    expect(group.at+group.every*(group.count-1)).toBeLessThan(50);
   }
   if(groups.length>1){expect(groups[0].lane).toBe(0);expect(groups[1].lane).toBe(1);
    expect(groups[1].at).toBeGreaterThanOrEqual(groups[0].at+6);expect(override.preview).toContain('Юг / короткая');}
  }
 });
 it('has three legal, distinct, explicitly unverified candidate plans',()=>{
  expect(REPLAY_PLANS.map(p=>p.mode)).toEqual(['standard','half-cash','iron-oath']);
  expect(FIRST_ARRIVAL_TOWERS).toHaveLength(23);expect(FIRST_ARRIVAL_TOWERS).not.toContain('prism');
  for(const plan of REPLAY_PLANS){
   expect(plan.verification.status).toBe('unverified');expect(plan.difficulty).toBe('hard');
   expect(validateReplayPlan(plan)).toEqual([]);
   expect(plan.actions.length).toBeGreaterThan(9);expect(plan.contingencies.length).toBeGreaterThanOrEqual(2);
  }
  expect(REPLAY_PLANS[0].actions).not.toEqual(REPLAY_PLANS[1].actions);
 });
 it('keeps base placements within guaranteed wave-reward floor, excluding upgrades and pops',()=>{
  for(const plan of REPLAY_PLANS)for(const item of placementBudgetFloor(plan)){
   expect(item.cost).toBeGreaterThan(0);
   expect(item.remaining,`${plan.mode} wave ${item.wave}`).toBeGreaterThanOrEqual(0);
  }
 });
 it('has self-contained SVG/HTML assets and no income towers in iron oath',()=>{
  const iron=REPLAY_PLANS[2];
  const purchases=iron.actions.filter(a=>a.kind==='place').map(a=>a.kind==='place'?a.tower:'');
  expect(purchases).not.toContain('mint');expect(purchases).not.toContain('orchard');
  for(const name of ['background.svg','thumbnail.svg','preview.html']){
   const text=readFileSync(new URL(`../../public/art/maps/prism-quarry/${name}`,import.meta.url),'utf8');
   expect(text.length).toBeGreaterThan(1000);
   expect(text).toContain('Призменный карьер');
   expect(text).not.toMatch(/(?:href|src)=["']https?:\/\//);
  }
 });
});
