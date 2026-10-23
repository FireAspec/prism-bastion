import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getMap} from '../../src/content/maps/orchard-wall';
import {laneLength,pointOnLane} from '../../src/contracts/geometry';
import {SITES,analyzeOrchardWall} from '../../validation/maps/orchard-wall/geometry-check';
import {loadReplayCandidates,validateReplayCandidates} from '../../validation/maps/orchard-wall/run-replays';

const dir=resolve(dirname(fileURLToPath(import.meta.url)),'../../public/art/maps/orchard-wall');
describe('orchard-wall map v1',()=>{
 it('uses the intended campaign position without overriding difficulty rules',()=>{
  const m=getMap();expect(m).toMatchObject({id:'orchard-wall',name:'Садовая стена',difficulty:1,campaignIndex:5,recommendedDifficulty:'easy',theme:'garden',pathWidth:42});
  expect(m.waveOverrides).toEqual({});expect(Object.keys(m)).not.toContain('rounds');
  expect(m.background).toBe('/art/maps/orchard-wall/background.svg');
 });
 it('isolates catalog data from runtime mutation',()=>{
  const m=getMap();m.lanes[0][0].x=500;m.water.pop();
  expect(getMap().lanes[0][0].x).toBe(0);expect(getMap().water).toHaveLength(1);
 });
 it('has a safe, bounded continuous track, explicit bridges and usable dry and water sites',()=>{
  const report=analyzeOrchardWall();expect(report.errors).toEqual([]);expect(report.valid).toBe(true);
  expect(report.crossings).toEqual(['6/13','19/26']);expect(report.laneLength).toBeGreaterThan(3400);
  expect(report.sites.filter(s=>s.safe&&s.terrain==='land')).toHaveLength(9);
  expect(report.sites.filter(s=>s.safe&&s.terrain==='water')).toHaveLength(2);
 });
 it('provides enough path to react at hypothetical fast speeds',()=>{
  const lane=getMap().lanes[0],length=laneLength(lane);expect(length/260).toBeGreaterThan(12);
  for(const progress of [0,length/3,length*.75,length]){
   const p=pointOnLane(lane,progress);expect(p.x).toBeGreaterThanOrEqual(0);expect(p.x).toBeLessThanOrEqual(1280);
  }
 });
 it('exposes meaningful route arcs to west, center, east and last guard',()=>{
  const lane=getMap().lanes[0],length=laneLength(lane);
  for(const id of ['west-inner','central','east-inner','east-south']){
   const site=SITES.find(s=>s.id===id)!;let count=0;
   for(let d=0;d<=length;d+=5){const p=pointOnLane(lane,d);if(Math.hypot(p.x-site.pos.x,p.y-site.pos.y)<=180)count++;}
   expect(count*5,`180px-range route coverage of ${id}`).toBeGreaterThan(180);
  }
 });
 it('keeps preview and thumbnail route aligned with authoritative MapDef',()=>{
  const html=readFileSync(resolve(dir,'preview.html'),'utf8'),thumb=readFileSync(resolve(dir,'thumbnail.svg'),'utf8');
  const json=html.match(/<script type="application\/json" id="geometry">(.*?)<\/script>/s);expect(json).not.toBeNull();
  const geom=JSON.parse(json![1]) as {pathWidth:number;lanes:number[][][]};const m=getMap();
  expect(geom.pathWidth).toBe(m.pathWidth);expect(geom.lanes).toEqual(m.lanes.map(l=>l.map(p=>[p.x,p.y])));
  expect(thumb).toContain('M'+m.lanes[0].map(p=>`${p.x} ${p.y}`).join(' '));
  expect(html).toContain('background.svg');expect(html).toContain('Перекрёстный огонь');expect(html).toContain('Контроль и усиление');
 });
 it('keeps SVG visual landmarks and terrain aligned and free of network dependencies',()=>{
  const bg=readFileSync(resolve(dir,'background.svg'),'utf8'),thumb=readFileSync(resolve(dir,'thumbnail.svg'),'utf8');
  expect(bg).toContain('viewBox="0 0 1280 720"');expect(thumb).toContain('viewBox="0 0 640 360"');
  expect(bg).toContain('M0 624 146 611 283 622 419 605 566 625 750 604 901 625 1071 611 1199 622 1280 605');
  expect(bg).toContain('M248 307 260 284 330 289 354 319 338 347 267 347Z');
  expect(bg).toContain('M885 315 902 299 962 298 992 327 980 356 913 357Z');
  for(const svg of [bg,thumb])expect(svg).not.toMatch(/<script\b|(?:href|src)\s*=\s*["']https?:\/\/|onload\s*=|<foreignObject\b/i);
 });
 it('supplies three honest campaign-legal, structurally valid replay candidates',()=>{
  const scripts=loadReplayCandidates();expect(scripts.status).toBe('unverified');
  expect(validateReplayCandidates(scripts)).toEqual([]);
  expect(scripts.scenarios.map(s=>s.modeId)).toEqual(['standard','half-cash','iron-oath']);
  expect(scripts.allowedFirstArrivalTowers).not.toContain('mint');expect(scripts.allowedFirstArrivalTowers).not.toContain('orchard');
 });
});
