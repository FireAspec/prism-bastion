import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getMap} from '../../src/content/maps/fallen-observatory';
import {analyzeGeometry,checkSite,landSites,waterSites} from '../../validation/maps/fallen-observatory/geometry';
import {candidates,FIRST_VISIT_TOWERS,basePurchaseLedger,replayOptions} from '../../validation/maps/fallen-observatory/replays';

describe('fallen observatory',()=>{
 it('has stable metadata and independently returned geometry',()=>{
  const a=getMap();expect(a).toMatchObject({id:'fallen-observatory',campaignIndex:12,difficulty:3,
   recommendedDifficulty:'hard',theme:'garden',pathWidth:54,
   background:'/art/maps/fallen-observatory/background.svg'});
  a.lanes[0][0].x=999;expect(getMap().lanes[0][0].x).toBe(0);
 });
 it('keeps roads, ruins, ponds and conservative footprints valid',()=>{
  const result=analyzeGeometry(getMap());
  expect(result.errors).toEqual([]);expect(result.ok).toBe(true);
  expect(result.laneLengths[0]).toBeGreaterThan(1300);
  expect(result.travelSeconds.dart[0]).toBeGreaterThan(10);
  expect(result.travelSeconds.scarlet[0]).toBeGreaterThan(25);
  expect(landSites.length).toBeGreaterThanOrEqual(9);expect(waterSites.length).toBe(3);
 });
 it('rejects an invalid road/ruin/pond placement',()=>{
  const bad=(x:number,y:number)=>({id:'bad',point:{x,y},radius:24,purpose:''});
  expect(checkSite(getMap(),bad(100,170))).toContain('intersects road');
  expect(checkSite(getMap(),bad(600,100))).toContain('intersects debris');
  expect(checkSite(getMap(),bad(145,566))).toContain('intersects water');
  expect(checkSite(getMap(),waterSites[0],true)).toEqual([]);
 });
 it('draws every collision polygon visibly in the vector background',()=>{
  const svg=readFileSync('public/art/maps/fallen-observatory/background.svg','utf8');
  const expected=[...getMap().blocked,...getMap().water].map(poly=>poly.map(p=>`${p.x},${p.y}`).join(' '));
  const points=[...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m=>m[1]);
  expect(points.sort()).toEqual(expected.sort());
  expect(svg).toContain('viewBox="0 0 1280 720"');
  expect(readFileSync('public/art/maps/fallen-observatory/thumbnail.svg','utf8')).toContain('viewBox="0 0 640 360"');
  expect(readFileSync('public/art/maps/fallen-observatory/preview.html','utf8')).toContain('background.svg');
 });
 it('provides three honest, legal replay fixtures',()=>{
  expect(candidates.map(c=>c.modeId).sort()).toEqual(['half-cash','iron-oath','standard']);
  expect(FIRST_VISIT_TOWERS).toHaveLength(22);expect(FIRST_VISIT_TOWERS).not.toContain('gravity');
  for(const c of candidates){
   expect(c.status).toBe('unverified');expect(replayOptions(c).knowledge).toEqual([]);
   expect(replayOptions(c).unlockedTowers).toEqual([...FIRST_VISIT_TOWERS]);
   expect(c.steps.length).toBeGreaterThanOrEqual(10);
   for(const row of basePurchaseLedger(c))expect(row.afterIgnoringKillIncomeAndUpgradeCosts).toBeGreaterThanOrEqual(0);
  }
 });
});
