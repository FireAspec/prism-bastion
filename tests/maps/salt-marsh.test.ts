import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {WORLD} from '../../src/contracts';
import {distance,laneLength,pointInPolygon} from '../../src/contracts/geometry';
import {getMap} from '../../src/content/maps/salt-marsh';
import {analyzeGeometry,canPlace,COMPOSITIONS,LAND_FOOTPRINT,MARGIN,pointToLaneDistance,SITES,WATER_FOOTPRINT,WATER_SITES} from '../../validation/maps/salt-marsh/check-geometry';
import {FIRST_ARRIVAL_TOWERS,REPLAYS,roundRewardsThrough,runOptions} from '../../validation/maps/salt-marsh/replay-fixture';

const map=getMap();
const art=new URL('../../public/art/maps/salt-marsh/',import.meta.url);
describe('Salt Marsh frozen map contract',()=>{
 it('has the correct progression position, visual theme and locked reward',()=>{
  expect([map.id,map.name,map.campaignIndex,map.difficulty,map.theme,map.recommendedDifficulty]).toEqual([
   'salt-marsh','Солёные болота',9,2,'estuary','normal',
  ]);
  expect(map.pathWidth).toBe(40);
  expect(map.background).toBe('/art/maps/salt-marsh/background.svg');
  expect(map.waveOverrides).toEqual({});
  expect(FIRST_ARRIVAL_TOWERS).toHaveLength(19);
  expect(FIRST_ARRIVAL_TOWERS).toContain('harbor');
  expect(FIRST_ARRIVAL_TOWERS).not.toContain('tide');
  expect(FIRST_ARRIVAL_TOWERS).not.toContain('coral');
 });
 it('provides two distinct long causeways with a common visible exit',()=>{
  expect(map.lanes).toHaveLength(2);
  const [north,south]=map.lanes;
  expect(north[0]).toEqual({x:10,y:182});
  expect(south[0]).toEqual({x:10,y:552});
  expect(north.slice(-3)).toEqual(south.slice(-3));
  expect(north.at(-1)).toEqual({x:1270,y:361});
  expect(Math.abs(laneLength(north)-laneLength(south))).toBeLessThan(30);
  expect(Math.min(...map.lanes.map(laneLength))).toBeGreaterThan(1300);
  for(const lane of map.lanes)for(let i=1;i<lane.length;i++)expect(distance(lane[i-1],lane[i])).toBeGreaterThan(8);
 });
 it('passes machine-readable topology and buildability checks',()=>{
  const report=analyzeGeometry(map);
  expect(report.ok).toBe(true);
  expect(report.errors).toEqual([]);
  expect(report.shortestPassageSeconds.ordinary).toBeGreaterThan(12);
  expect(report.shortestPassageSeconds.fast).toBeGreaterThan(7.5);
  expect(report.drySites).toHaveLength(8);
  expect(report.wetSites).toHaveLength(2);
 });
 it('detects a zero-length segment and an obstructed causeway',()=>{
  const broken=structuredClone(map);
  broken.lanes[0][1]={...broken.lanes[0][0]};
  expect(analyzeGeometry(broken).errors.some(e=>e.includes('degenerate'))).toBe(true);
  const obstructed=structuredClone(map);
  obstructed.blocked.push([{x:85,y:165},{x:119,y:165},{x:119,y:196},{x:85,y:196}]);
  expect(analyzeGeometry(obstructed).errors.some(e=>e.includes('overlaps lane'))).toBe(true);
  expect(canPlace(map,{x:420,y:356},LAND_FOOTPRINT,'land')).toBe(false);
  expect(canPlace(map,{x:100,y:178},LAND_FOOTPRINT,'land')).toBe(false);
 });
 it('reserves two independent land compositions and future water slots',()=>{
  expect(map.water).toHaveLength(2);
  expect(map.blocked.length).toBeGreaterThanOrEqual(5);
  const comps=Object.values(COMPOSITIONS).map(c=>new Set(c));
  expect([...comps[0]].filter(id=>comps[1].has(id)).length).toBeLessThan(comps[0].size/2);
  for(const group of Object.values(COMPOSITIONS)){
   expect(group.length).toBeGreaterThanOrEqual(3);
   for(const id of group){
    const p=SITES[id];
    expect(canPlace(map,p,LAND_FOOTPRINT,'land')).toBe(true);
    expect(map.lanes.some(l=>pointToLaneDistance(p,l)<170)).toBe(true);
    expect(p.x).toBeGreaterThan(LAND_FOOTPRINT+MARGIN);
   }
  }
  for(const p of Object.values(WATER_SITES)){
   expect(map.water.some(poly=>pointInPolygon(p,poly))).toBe(true);
   expect(canPlace(map,p,WATER_FOOTPRINT,'water')).toBe(true);
  }
  expect(map.lanes.every(l=>l.every(p=>p.x>=0&&p.x<=WORLD.width&&p.y>=0&&p.y<=WORLD.height))).toBe(true);
 });
});

describe('Salt Marsh map presentation',()=>{
 it('keeps the production background decorative, scalable and offline',()=>{
  const svg=readFileSync(new URL('background.svg',art),'utf8');
  expect(svg).toContain('viewBox="0 0 1280 720"');
  expect(svg).toContain('id="westWater"');
  expect(svg).toContain('id="eastWater"');
  expect(svg).toContain('id="powerRing"');
  expect(svg).not.toMatch(/<script\b|<foreignObject\b/i);
  expect(svg).not.toMatch(/(?:href|src)="https?:\/\//i);
 });
 it('has an original standalone thumbnail',()=>{
  const svg=readFileSync(new URL('thumbnail.svg',art),'utf8');
  expect(svg).toContain('viewBox="0 0 320 180"');
  expect(svg).toContain('СОЛЁНЫЕ БОЛОТА');
  expect(svg).not.toContain('background.svg');
 });
 it('keeps the interactive preview synchronized to the actual map geometry',()=>{
  const html=readFileSync(new URL('preview.html',art),'utf8');
  const raw=html.match(/<script type="application\/json" id="geometry">([\s\S]*?)<\/script>/)?.[1];
  expect(raw).toBeDefined();
  const preview=JSON.parse(raw!) as {lanes:number[][][];sites:Record<string,number[]>;waterSites:Record<string,number[]>};
  expect(preview.lanes).toEqual(map.lanes.map(l=>l.map(p=>[p.x,p.y])));
  expect(preview.sites).toEqual(Object.fromEntries(Object.entries(SITES).map(([id,p])=>[id,[p.x,p.y]])));
  expect(preview.waterSites).toEqual(Object.fromEntries(Object.entries(WATER_SITES).map(([id,p])=>[id,[p.x,p.y]])));
  expect(html).toContain('href="background.svg"');
 });
});

describe('Replay candidates without fictional victory',()=>{
 it('lists three legal 60-wave normal scenarios, fixed roster and no knowledge',()=>{
  expect(REPLAYS.map(s=>s.modeId)).toEqual(['standard','half-cash','iron-oath']);
  for(const scenario of REPLAYS){
   expect(scenario.status).toBe('unverified');
   expect(scenario.mapId).toBe('salt-marsh');
   expect(scenario.requiredWaves).toBe(60);
   expect(scenario.difficulty).toBe('normal');
   expect(scenario.roster).toEqual(FIRST_ARRIVAL_TOWERS);
   expect(runOptions(scenario).knowledge).toEqual([]);
   expect(scenario.actions.length).toBeGreaterThan(10);
   expect(scenario.counters.length).toBeGreaterThanOrEqual(4);
   expect(new Set(scenario.actions.map(a=>a.id)).size).toBe(scenario.actions.length);
   for(const a of scenario.actions){
    expect(a.wave).toBeGreaterThanOrEqual(1);
    expect(a.latestWave).toBeLessThanOrEqual(60);
    expect(a.latestWave).toBeGreaterThanOrEqual(a.wave);
    expect(a.tick).toBeGreaterThanOrEqual(0);
    expect(a.cashFloor).toBeGreaterThanOrEqual(0);
    if(a.action.type==='place'){
     expect(scenario.roster).toContain(a.action.tower);
     expect(canPlace(map,SITES[a.action.site],LAND_FOOTPRINT,'land')).toBe(true);
    }
   }
  }
 });
 it('has no farm, resell or extra cash strategy in iron oath',()=>{
  const iron=REPLAYS.find(s=>s.modeId==='iron-oath')!;
  expect(iron.actions.every(s=>s.action.type==='place'||s.action.type==='upgrade'||s.action.type==='target')).toBe(true);
  expect(iron.actions.every(s=>s.action.type!=='place'||!['mint','orchard','bank'].includes(s.action.tower))).toBe(true);
 });
 it('uses exact normal wave reward sums without invented layer payouts',()=>{
  expect(roundRewardsThrough(20,'standard')).toBe(2440);
  expect(roundRewardsThrough(20,'half-cash')).toBe(1220);
  expect(roundRewardsThrough(60,'iron-oath')).toBe(12120);
  expect(roundRewardsThrough(60,'half-cash')).toBe(6060);
  expect(REPLAYS.find(s=>s.modeId==='half-cash')?.startingCredits).toBe(450);
 });
});
