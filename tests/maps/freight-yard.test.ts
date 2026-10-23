import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getMap} from '../../src/content/maps/freight-yard';
import {laneLength,distanceToSegment,pointInPolygon} from '../../src/contracts/geometry';
import {analyzeFreightYard,isLandClear,spots,TOWER_RADIUS,BUFFER} from '../../validation/maps/freight-yard/geometry-check';
import {auditPlans,fixture} from '../../validation/maps/freight-yard/replay';

const asset=(name:string)=>readFileSync(new URL(`../../public/art/maps/freight-yard/${name}`,import.meta.url),'utf8');

describe('Freight Yard / MapDef',()=>{
 it('uses frozen catalog identity and progression order',()=>{
  const m=getMap();expect(m.id).toBe('freight-yard');expect(m.campaignIndex).toBe(6);
 });
 it('separates geometric group from selected difficulty',()=>{
  const m=getMap();expect(m.difficulty).toBe(2);expect(m.recommendedDifficulty).toBe('normal');
 });
 it('has foundry theme and correct asset reference',()=>{
  const m=getMap();expect(m.theme).toBe('foundry');expect(m.background).toBe('/art/maps/freight-yard/background.svg');
 });
 it('uses precise 52px wide routes',()=>{expect(getMap().pathWidth).toBe(52);});
 it('defines west and south world-edge entrances',()=>{
  const m=getMap();expect(m.lanes).toHaveLength(2);
  expect(m.lanes[0][0]).toEqual({x:0,y:164});expect(m.lanes[1][0]).toEqual({x:941,y:720});
 });
 it('defines a common 210px corridor exiting on the east edge',()=>{
  const m=getMap();expect(m.lanes[0].slice(-3)).toEqual(m.lanes[1].slice(-3));
  expect(m.lanes[0].at(-1)).toEqual({x:1280,y:380});
 });
 it('offers long reaction distances from both entrances',()=>{
  const m=getMap();expect(laneLength(m.lanes[0])).toBeGreaterThan(1400);
  expect(laneLength(m.lanes[1])).toBeGreaterThan(1800);
 });
 it('returns fresh data after another game instance mutates its copy',()=>{
  const copy=getMap();copy.lanes[0][0].x=77;copy.water[0].pop();copy.waveOverrides[1].groups?.pop();
  const again=getMap();expect(again.lanes[0][0].x).toBe(0);
  expect(again.water[0]).toHaveLength(5);expect(again.waveOverrides[1].groups).toHaveLength(1);
 });
 it('passes automated finite bounds, polyline, polygon and footprint checks',()=>{
  const report=analyzeFreightYard();expect(report.status).toBe('pass');expect(report.checks.filter(c=>!c.ok)).toEqual([]);
 });
 it('allows two independent build pads between the routes',()=>{
  const m=getMap(),center={x:650,y:330};
  const nearest=(lane:typeof m.lanes[number])=>Math.min(...lane.slice(1).map((p,i)=>distanceToSegment(center,lane[i],p)));
  expect(nearest(m.lanes[0])).toBeLessThan(160);expect(nearest(m.lanes[1])).toBeLessThan(160);
  expect(isLandClear({x:599,y:330})).toBe(true);expect(isLandClear({x:699,y:331})).toBe(true);
 });
 it('maintains at least three strategic positions plus meaningful outer alternatives',()=>{
  expect(spots).toHaveLength(13);
  expect(spots.filter(s=>isLandClear({x:s.x,y:s.y}))).toHaveLength(13);
  expect(spots.some(s=>s.id==='north-gantry'&&s.y<120)).toBe(true);
  expect(spots.some(s=>s.id==='south-yard'&&s.y>600)).toBe(true);
 });
 it('reserves real water for later water-only towers',()=>{
  const m=getMap();expect(m.water).toHaveLength(2);
  expect(pointInPolygon({x:90,y:595},m.water[0])).toBe(true);
  expect(pointInPolygon({x:1196,y:638},m.water[1])).toBe(true);
  expect(spots.every(s=>m.water.every(poly=>!pointInPolygon(s,poly)))).toBe(true);
 });
 it('has room for distinct land footprints without crossing lane shoulders',()=>{
  const central=spots.filter(s=>s.id==='central-west'||s.id==='central-east');
  expect(Math.hypot(central[0].x-central[1].x,central[0].y-central[1].y)).toBeGreaterThanOrEqual(2*TOWER_RADIUS+BUFFER);
 });
 it('alternates first groups to teach the second entrance',()=>{
  const o=getMap().waveOverrides;
  expect(Object.keys(o)).toHaveLength(9);expect(o[1].groups?.[0].lane).toBe(0);expect(o[2].groups?.[0].lane).toBe(1);
  expect(o[3].groups?.map(g=>g.lane)).toEqual([0,1]);expect(o[4].groups?.map(g=>g.lane)).toEqual([1,0]);
 });
 it('never duplicates boss identity or round money from the shared wave programme',()=>{
  for(const o of Object.values(getMap().waveOverrides)){
   expect(o.boss).toBeUndefined();expect(o.reward).toBeUndefined();
   expect(o.groups?.every(g=>g.count>0&&g.every>0&&g.at>=0)).toBe(true);
  }
 });
});

describe('Freight Yard resources and replay handoff',()=>{
 it('contains separate world and 2:1 miniature SVG drawings',()=>{
  const b=asset('background.svg'),t=asset('thumbnail.svg');
  expect(b).toContain('viewBox="0 0 1280 720"');expect(t).toContain('viewBox="0 0 640 360"');
  expect(b).toContain('M941 720V640');expect(t).toContain('ГРУЗОВОЙ ДВОР');
 });
 it('contains a local-only, useful interactive visual preview',()=>{
  const h=asset('preview.html');expect(h).toContain('src="background.svg"');expect(h).toContain('src="thumbnail.svg"');
  expect(h).toContain('data-layer="routes"');expect(h).not.toMatch(/https?:\/\//);
 });
 it('keeps preview polylines and positions synchronized with live map coordinates',()=>{
  const h=asset('preview.html');
  for(const l of getMap().lanes)expect(h).toContain(`points="${l.map(v=>`${v.x},${v.y}`).join(' ')}"`);
  for(const s of spots)expect(h).toContain(`translate(${s.x} ${s.y})`);
 });
 it('passes machine-readable plan audit without pretending to prove victory',()=>{
  const a=auditPlans();expect(a.status).toBe('static-pass-replay-unverified');expect(a.errors).toEqual([]);
  expect(fixture.status).toBe('unverified');expect(fixture.evidence).toBeNull();
 });
 it('excludes technologies unlocked only after clearing this map',()=>{
  expect(fixture.firstArrivalTowers).toHaveLength(14);
  expect(fixture.firstArrivalTowers).not.toContain('drone');expect(fixture.firstArrivalTowers).not.toContain('rocket');
 });
 it('provides three different strategy compositions without iron-oath economy exploits',()=>{
  expect(fixture.scenarios.map(p=>p.id)).toEqual(['standard','half-cash','iron-oath']);
  expect(fixture.scenarios[0].actions.some(a=>a[2]==='place'&&a[4]==='orchard')).toBe(true);
  expect(fixture.scenarios[1].actions.some(a=>a[2]==='place'&&a[4]==='orchard')).toBe(false);
  expect(fixture.scenarios[2].actions.some(a=>a[2]==='place'&&a[4]==='observatory')).toBe(true);
  expect(fixture.scenarios[2].actions.some(a=>a[2]==='place'&&['mint','orchard'].includes(a[4]))).toBe(false);
 });
});
