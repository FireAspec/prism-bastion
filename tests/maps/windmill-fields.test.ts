import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {WORLD} from '../../src/contracts';
import {getMap} from '../../src/content/maps/windmill-fields';
import {laneLength,pointOnLane} from '../../src/contracts/geometry';
import {LAND_SITES,WATER_SITES,canPlaceLand,canPlaceWater,inspectGeometry,
 polygonArea,pathClearance,rangeCoverage} from '../../validation/maps/windmill-fields/geometry';
import {REPLAYS,validateStaticReplay,baseCostEasy,guaranteedRoundIncome}
 from '../../validation/maps/windmill-fields/run-replays';

describe('windmill-fields map',()=>{
 it('exposes the v1 map contract, campaign position and locked rewards correctly',()=>{
  const map=getMap();
  expect(map).toMatchObject({
   id:'windmill-fields',campaignIndex:3,difficulty:1,recommendedDifficulty:'easy',
   pathWidth:46,theme:'garden',background:'/art/maps/windmill-fields/background.svg',
  });
  expect(map.waveOverrides).toEqual({});
  expect(map.lanes).toHaveLength(1);
  expect(map.water).toHaveLength(2);
  expect(map.blocked).toHaveLength(3);
 });

 it('returns independent world geometry, including nested polygons',()=>{
  const a=getMap(),b=getMap();
  a.lanes[0][0].x=501;
  a.water[0][0].x=501;
  a.blocked[0][0].x=501;
  a.waveOverrides[10]={preview:'test'};
  expect(b.lanes[0][0].x).toBe(0);
  expect(b.water[0][0].x).toBe(428);
  expect(b.blocked[0][0].x).toBe(125);
  expect(b.waveOverrides[10]).toBeUndefined();
 });

 it('keeps road and obstacle geometry finite, unobstructed and without self-intersections',()=>{
  const check=inspectGeometry();
  expect(check.errors,check.errors.join('\n')).toEqual([]);
  expect(check.segments).toBeGreaterThanOrEqual(17);
  expect(check.shortestSegment).toBeGreaterThanOrEqual(20);
  expect(check.minimumNonAdjacentGap).toBeGreaterThan(58);
  expect(check.minimumSceneryClearance).toBeGreaterThan(0);
  expect(check.pathLength).toBeGreaterThan(4000);
  expect(check.pathLength).toBeLessThan(8000);
  expect(check.validLandSites).toHaveLength(8);
  expect(check.validWaterSites).toHaveLength(2);
  expect(check.responseSecondsAt150).toBeGreaterThan(0);
  expect(check.responseSecondsAt150).toBeLessThan(3);
 });

 it('connects visible entrance at west edge to a visible internal energy terminal',()=>{
  const lane=getMap().lanes[0],last=lane[lane.length-1],start=lane[0];
  expect(start).toEqual({x:0,y:80});
  expect(last).toEqual({x:670,y:452});
  expect(pointOnLane(lane,0)).toEqual(start);
  const end=pointOnLane(lane,laneLength(lane));
  expect(end.x).toBeCloseTo(last.x,8);
  expect(end.y).toBeCloseTo(last.y,8);
  expect(last.x).toBeGreaterThan(WORLD.width*.25);
  expect(last.x).toBeLessThan(WORLD.width*.75);
 });

 it('has eight distinct valid dry placements with at least three tactical zones',()=>{
  const map=getMap(),sites=Object.entries(LAND_SITES);
  for(const [name,site] of sites){
   expect(canPlaceLand(site,30,map),name).toBe(true);
   expect(pathClearance(site,map),name).toBeGreaterThanOrEqual(30);
   expect(rangeCoverage(map.lanes[0],site,150),name).toBeGreaterThan(80);
  }
  const place=(id:keyof typeof LAND_SITES)=>LAND_SITES[id];
  expect(place('N1').y).toBeLessThan(200);
  expect(place('C1').y).toBeGreaterThan(400);
  expect(place('S1').y).toBeGreaterThan(580);
  expect(canPlaceLand({x:500,y:80},24,map)).toBe(false);
  expect(canPlaceLand({x:155,y:166},24,map)).toBe(false);
  expect(canPlaceLand({x:497,y:301},24,map)).toBe(false);
 });

 it('provides two usable water pools without taking away land placements',()=>{
  const map=getMap();
  for(const [name,p] of Object.entries(WATER_SITES)){
   expect(canPlaceWater(p,18,map),name).toBe(true);
   expect(canPlaceLand(p,18,map),name).toBe(false);
  }
  expect(map.water.every(poly=>polygonArea(poly)>2000)).toBe(true);
  expect(canPlaceWater(LAND_SITES.C1,18,map)).toBe(false);
 });

 it('ships actual separate vector assets and a self-contained path preview',()=>{
  const root=new URL('../../public/art/maps/windmill-fields/',import.meta.url);
  const background=readFileSync(new URL('background.svg',root),'utf8');
  const thumbnail=readFileSync(new URL('thumbnail.svg',root),'utf8');
  const preview=readFileSync(new URL('preview.html',root),'utf8');
  expect(background).toContain('viewBox="0 0 1280 720"');
  expect(background).toContain('id="windmill"');
  expect(background).not.toContain('class="road"');
  expect(thumbnail).toContain('viewBox="0 0 640 360"');
  expect(thumbnail).toContain('ПОЛЯ ВЕТРЯКОВ');
  expect(preview).toContain('<image href="./background.svg"');
  expect(preview).toContain('M0 80L1150 80 1195 130');
  expect(preview).toContain('id="showRoad"');
  expect(preview).not.toMatch(/<script[^>]+src=/);
 });

 it('guards first-visit replay technology, scenario schedule and wave-one budget',()=>{
  expect(validateStaticReplay()).toEqual([]);
  expect(REPLAYS.verification).toBe('unverified');
  expect(REPLAYS.scenarios.map(s=>s.modeId).sort()).toEqual(['half-cash','iron-oath','standard']);
  expect(REPLAYS.scenarios.every(s=>s.actions.length>=17)).toBe(true);
  expect(baseCostEasy('needle')).toBe(213);
  expect(guaranteedRoundIncome(10,false)).toBe(1125);
  expect(guaranteedRoundIncome(10,true)).toBe(562);
 });
});
