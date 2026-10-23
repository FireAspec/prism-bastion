import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {getMap} from '../../src/content/maps/mirror-terrace';
import {laneLength} from '../../src/contracts/geometry';
import {analyzeGeometry,landSites,landBuildable,waterSites,waterBuildable} from '../../validation/maps/mirror-terrace/geometry';
import {candidates,FIRST_VISIT_TOWERS} from '../../validation/maps/mirror-terrace/replays';

const asset=(name:string)=>readFileSync(new URL('../../public/art/maps/mirror-terrace/'+name,import.meta.url),'utf8');

describe('map 14 / mirror terrace',()=>{
 it('retains the frozen map contract and does not mutate other callers',()=>{
  const map=getMap();
  expect({id:map.id,index:map.campaignIndex,difficulty:map.difficulty,mode:map.recommendedDifficulty,theme:map.theme})
   .toEqual({id:'mirror-terrace',index:14,difficulty:3,mode:'hard',theme:'garden'});
  expect(map.pathWidth).toBe(44);
  expect(map.background).toBe('/art/maps/mirror-terrace/background.svg');
  expect(map.lanes).toHaveLength(2);
  expect(map.water).toHaveLength(2);
  expect(map.waveOverrides).toEqual({});
  const x=map.lanes[0][0].x;
  map.lanes[0][0].x=999;
  map.water[0][0].x=999;
  expect(getMap().lanes[0][0].x).toBe(x);
  expect(getMap().water[0][0].x).toBe(85);
 });

 it('has bounded polygons, a single crossing, two visible exits, valid dry pads and water pads',()=>{
  const report=analyzeGeometry();
  expect(report.errors).toEqual([]);
  expect(report.ok).toBe(true);
  expect(report.crossings).toHaveLength(1);
  expect(report.crossings[0].x).toBeCloseTo(650,4);
  expect(report.crossings[0].y).toBeCloseTo(360,4);
  expect(report.laneLengths.every(length=>length>1350)).toBe(true);
  expect(report.fastestTransitSeconds.every(seconds=>seconds>=9)).toBe(true);
  expect(getMap().lanes[0].at(-1)?.y).not.toBe(getMap().lanes[1].at(-1)?.y);
  expect(Object.keys(landSites).length).toBeGreaterThanOrEqual(6);
  for(const [name,pos] of Object.entries(landSites))expect(landBuildable(pos),'site '+name).toBe(true);
  for(const pos of waterSites)expect(waterBuildable(pos)).toBe(true);
 });

 it('keeps displayed route overlay identical to combat lane geometry',()=>{
  const html=asset('preview.html');
  const roadPoints=[...html.matchAll(/<polyline points="([^"]+)"/g)].map(m=>m[1]);
  expect(roadPoints).toHaveLength(6);
  for(let index=0;index<2;index++){
   const expected=getMap().lanes[index].map(point=>point.x+','+point.y).join(' ');
   expect(roadPoints[index]).toBe(expected);
   expect(roadPoints[index+2]).toBe(expected);
   expect(roadPoints[index+4]).toBe(expected);
  }
  expect(html).toContain('background.svg');
  expect(html).toContain('thumbnail.svg');
  expect(html).toContain('body:has(#show:not(:checked)) .frame .overlay');
  expect(html).toContain('body:has(#pads:not(:checked)) .frame .pads');
 });

 it('ships two independent local SVG assets with no external loading',()=>{
  const background=asset('background.svg'),thumbnail=asset('thumbnail.svg');
  expect(background).toContain('viewBox="0 0 1280 720"');
  expect(thumbnail).toContain('viewBox="0 0 512 288"');
  for(const graphic of [background,thumbnail]){
   expect(graphic).toContain('</svg>');
   expect(graphic).not.toMatch(/<script|<image|https?:\/\/[^"]+\.(?:png|jpe?g|webp)/i);
  }
  // SVG 1.1 references also render the shrubs and lamps in older rasterizers.
  expect(background).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
  expect([...background.matchAll(/<use xlink:href="#(?:shrub|lamp)"/g)]).toHaveLength(29);
  expect(background).not.toContain('<use href=');
  expect(background).not.toEqual(thumbnail);
 });

 it('schedules legal, reproducible, honestly unverified candidates with opening budgets',()=>{
  expect(candidates.map(c=>c.modeId)).toEqual(['standard','half-cash','iron-oath']);
  expect(FIRST_VISIT_TOWERS).not.toContain('mirror');
  expect(FIRST_VISIT_TOWERS).toHaveLength(24);
  const openings=[{cash:850,spent:825,remaining:25},{cash:425,spent:275,remaining:150},
   {cash:850,spent:743,remaining:107}];
  for(const [index,plan] of candidates.entries()){
   expect(plan.status).toBe('unverified');
   expect(plan.reason.length).toBeGreaterThan(25);
   expect(plan.difficulty).toBe('hard');
   expect(plan.startingCredits).toBe(openings[index].cash);
   expect(plan.openingSpent).toBe(openings[index].spent);
   expect(plan.openingBalance).toBe(openings[index].remaining);
   expect(plan.startingCredits-plan.openingSpent).toBe(plan.openingBalance);
   expect(plan.unlockedTowers).toEqual(FIRST_VISIT_TOWERS);
   const names=new Set<string>();
   let lastWave=0;
   for(const step of plan.steps){
    expect(step.wave).toBeGreaterThanOrEqual(lastWave);
    expect(step.wave).toBeLessThanOrEqual(80);
    expect(Number.isSafeInteger(step.tick)&&step.tick>=0).toBe(true);
    lastWave=step.wave;
    if(step.kind==='place'){
     expect(FIRST_VISIT_TOWERS).toContain(step.tower);
     expect(landBuildable(landSites[step.site])).toBe(true);
     expect(names.has(step.name)).toBe(false);
     names.add(step.name);
     if(plan.modeId==='iron-oath')expect(['mint','orchard']).not.toContain(step.tower);
    }else{
     expect(names.has(step.name)).toBe(true);
     if(step.kind==='upgrade')expect(step.path).toBeGreaterThanOrEqual(0);
    }
   }
   expect(names.size).toBeGreaterThanOrEqual(5);
   expect(plan.steps.some(step=>step.wave>=60)).toBe(true);
  }
 });

 it('supplies enough lane distance for the slow bosses as well as fast runners',()=>{
  const map=getMap();
  expect(map.lanes.every(lane=>laneLength(lane)/132>9)).toBe(true);
  expect(map.lanes.every(lane=>laneLength(lane)/17>70)).toBe(true);
 });
});
