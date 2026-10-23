import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getMap} from '../../src/content/maps/lantern-garden';
import {pointOnLane,pointInPolygon} from '../../src/contracts/geometry';
import {analyzeGeometry,LAND_SITES,WATER_SITES} from '../../validation/maps/lantern-garden/geometry';
import {replayCandidates,REPLAY_STATUS,guaranteedCreditsBeforeWave,executeCandidate} from '../../validation/maps/lantern-garden/replay.fixture';
import type {GameEngine,GameState} from '../../src/contracts';

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('map 01: world and progression boundaries',()=>{
 it('stays a group-one, early-story, single-route garden',()=>{
  const m=getMap();
  expect([m.id,m.name,m.theme,m.difficulty,m.campaignIndex,m.recommendedDifficulty])
   .toEqual(['lantern-garden','Сад фонарей','garden',1,1,'easy']);
  expect(m.lanes).toHaveLength(1);
  expect(m.pathWidth).toBe(46);
  expect(m.background).toMatch(/lantern-garden\/background\.svg$/);
  expect(m.lanes[0][0].x).toBe(0);
  expect(m.lanes[0].at(-1)?.x).toBe(1280);
  expect(m.lanes[0][0].y).not.toBe(m.lanes[0].at(-1)?.y);
 });
 it('routes an enemy through both hairpin sides before the visible exit',()=>{
  const {lanes}=getMap(),line=lanes[0];
  expect(line.some(p=>p.x>1060&&p.y>290&&p.y<395)).toBe(true);
  expect(line.some(p=>p.x<240&&p.y>490&&p.y<580)).toBe(true);
  expect(pointOnLane(line,0)).toEqual({x:0,y:170});
  expect(pointOnLane(line,1e6)).toEqual({x:1280,y:600});
  const r=analyzeGeometry();
  expect(r.valid).toBe(true);
  expect(r.turnbacks).toBe(2);
  expect(r.minSegmentLength).toBeGreaterThan(30);
  expect(r.lengthPixels).toBeGreaterThan(3200);
  expect(r.fastTransitSeconds).toBeGreaterThan(25);
 });
 it('keeps actual footprints clear of route, obstacles and world bounds',()=>{
  const report=analyzeGeometry();
  expect(report.safeLandSites).toHaveLength(10);
  expect(report.safeWaterSites).toHaveLength(3);
  expect(report.polygonRoadClearance).toBeGreaterThan(getMap().pathWidth/2);
  expect(report.safeLandSites.every(p=>p.roadClearance>=60)).toBe(true);
  expect(LAND_SITES.some(p=>p.id==='A')).toBe(true);
  expect(LAND_SITES.some(p=>p.id==='B')).toBe(true);
  expect(LAND_SITES.some(p=>p.id==='C')).toBe(true);
  const water=getMap().water[0];
  for(const p of WATER_SITES)expect(pointInPolygon(p.pos,water)).toBe(true);
 });
 it('bounds all wave overrides to a single lane, preserves awards and boss schedule',()=>{
  const override=getMap().waveOverrides;
  expect(Object.keys(override).map(Number)).toEqual([11,12,21,31]);
  for(const [n,w] of Object.entries(override)){
   expect(+n).toBeGreaterThan(10);
   expect(+n).toBeLessThan(40);
   expect(w.reward).toBeUndefined();
   expect(w.boss).toBeUndefined();
   expect(w.number).toBeUndefined();
   expect(w.groups?.length).toBeGreaterThanOrEqual(2);
   for(const g of w.groups??[]){
    expect(g.lane).toBe(0);
    expect(g.at).toBeGreaterThanOrEqual(0);
    expect(g.every).toBeGreaterThan(0);
    expect(g.count).toBeGreaterThan(0);
   }
  }
  expect(override[12].groups?.some(g=>g.enemy==='cloak')).toBe(true);
  expect(override[21].groups?.some(g=>g.enemy==='split')).toBe(true);
  expect(override[31].groups?.some(g=>g.enemy==='glacier')).toBe(true);
 });
});

describe('map 01: visible files',()=>{
 it('renders an isolated SVG background and standalone miniature without remote dependencies',()=>{
  for(const asset of ['background.svg','thumbnail.svg']){
   const file=read(`public/art/maps/lantern-garden/${asset}`);
   expect(file).toMatch(/^<svg /);
   expect(file).toContain('</svg>');
   expect(file).not.toMatch(/(?:href|src)="https?:\/\/|url\(https?:\/\/|<script|<foreignObject|<image /i);
  }
  const html=read('public/art/maps/lantern-garden/preview.html');
  expect(html).toContain('./background.svg');
  expect(html).toContain('viewBox="0 0 1280 720"');
  expect(html).toContain('aria-pressed');
  const routeMatch=html.match(/<polyline class="road" points="([^"]+)"/);
  expect(routeMatch).not.toBeNull();
  const route=routeMatch![1].split(' ').map(pair=>pair.split(',').map(Number));
  expect(route).toEqual(getMap().lanes[0].map(({x,y})=>[x,y]));
 });
});

describe('map 01: honest, executable strategy candidates',()=>{
 it('offers three distinct legal first-visit action scripts without reward towers',()=>{
  expect(REPLAY_STATUS).toBe('unverified');
  expect(replayCandidates.map(c=>c.modeId)).toEqual(['standard','half-cash','iron-oath']);
  const initial=new Set(['needle','cannon','frost','beacon']);
  for(const c of replayCandidates){
   expect(c.status).toBe('unverified');
   expect(c.expectedWaves).toBe(40);
   expect(c.knowledge).toHaveLength(0);
   expect(c.actions.length).toBeGreaterThan(17);
   expect(c.actions[0].wave).toBe(1);
   const placed=new Set<string>();
   for(const move of c.actions){
    expect(move.tick).toBeGreaterThanOrEqual(0);
    expect(move.wave).toBeGreaterThanOrEqual(1);
    expect(move.wave).toBeLessThanOrEqual(40);
    if(move.kind==='place'){
     expect(initial.has(move.tower)).toBe(true);
     expect(LAND_SITES.some(p=>p.id===move.site)).toBe(true);
     expect(placed.has(move.key)).toBe(false);
     placed.add(move.key);
    }else expect(placed.has(move.key)).toBe(true);
   }
   expect(c.countermeasures.length).toBeGreaterThanOrEqual(4);
  }
  expect(replayCandidates[0].actions[0]).not.toEqual(replayCandidates[2].actions[0]);
 });
 it('computes award-only starting budget, no assumed free kills',()=>{
  expect(guaranteedCreditsBeforeWave(1,'standard')).toBe(1000);
  expect(guaranteedCreditsBeforeWave(1,'half-cash')).toBe(500);
  expect(guaranteedCreditsBeforeWave(10,'standard')).toBe(2125);
  expect(guaranteedCreditsBeforeWave(20,'iron-oath')).toBe(3850);
  expect(guaranteedCreditsBeforeWave(40,'half-cash')).toBe(4400);
  expect(guaranteedCreditsBeforeWave(41,'standard')).toBe(9100);
 });
 it('rejects mismatched run options before any command can change state',()=>{
  let attempted=0;
  const engine={
   getSnapshot:()=>({options:{mapId:'different',difficulty:'easy',modeId:'standard',seed:380101,
    unlockedTowers:['needle','cannon','frost','beacon'],knowledge:[],players:[{id:'p1'}],endless:false},
    towers:[],phase:'build'} as unknown as GameState),
   dispatch:()=>{attempted++;return {ok:true};},
  } as unknown as GameEngine;
  expect(()=>executeCandidate(engine,replayCandidates[0])).toThrow('do not match');
  expect(attempted).toBe(0);
 });
 it('aborts a rejected purchase without issuing startWave or adding money',()=>{
  const initial={
   options:{mapId:'lantern-garden',difficulty:'easy',modeId:'standard',seed:380101,
    unlockedTowers:['needle','cannon','frost','beacon'],knowledge:[],players:[{id:'p1'}],endless:false},
   towers:[],phase:'build',lives:200,credits:1000,rules:{maxLives:200},
   stats:{spent:0,earned:0},
  } as unknown as GameState;
  let commands=0;
  const engine={getSnapshot:()=>initial,dispatch:()=>{commands++;return {ok:false,reason:'insufficient credits'};}} as unknown as GameEngine;
  const audit=executeCandidate(engine,replayCandidates[0]);
  expect(audit.status).toBe('rejected');
  expect(audit.completedWaves).toBe(0);
  expect(audit.credits).toBe(1000);
  expect(audit.placements).toHaveLength(0);
  expect(audit.failures).toEqual([expect.stringContaining('insufficient credits')]);
  expect(commands).toBe(1);
 });
});
