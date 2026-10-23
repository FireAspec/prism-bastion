import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {GameEngine,GameState,Vec} from '../../src/contracts';
import {getMap} from '../../src/content/maps/old-aqueduct';
import {distanceToSegment} from '../../src/contracts/geometry';
import {analyzeGeometry,canBuild,positions} from '../../validation/maps/old-aqueduct/check-geometry';
import {candidates,executeCandidate,firstArrivalTowers} from '../../validation/maps/old-aqueduct/replay-fixture';

const map=getMap();
const artRoot=new URL('../../public/art/maps/old-aqueduct/',import.meta.url);
const roadDistance=(p:Vec)=>Math.min(...map.lanes[0].slice(1).map((v,i)=>distanceToSegment(p,map.lanes[0][i],v)));

describe('Old Aqueduct map 04',()=>{
 it('implements the frozen map contract and no hidden wave or boss overrides',()=>{
  expect(map.id).toBe('old-aqueduct');expect(map.campaignIndex).toBe(4);
  expect(map.difficulty).toBe(1);expect(map.recommendedDifficulty).toBe('easy');
  expect(map.theme).toBe('garden');expect(map.pathWidth).toBe(62);
  expect(map.background).toBe('/art/maps/old-aqueduct/background.svg');
  expect(map.waveOverrides).toEqual({});expect(map.lanes).toHaveLength(1);
 });
 it('independently checks edges, zero segments, polygon clearance, dry and aquatic sites',()=>{
  const report=analyzeGeometry(map);
  expect(report.errors).toEqual([]);expect(report.ok).toBe(true);
  expect(report.pathLengths[0]).toBeGreaterThan(1300);
  expect(report.pathLengths[0]).toBeLessThan(1800);
  expect(report.minimumObstacleGap).toBeGreaterThan(map.pathWidth/2);
  expect(report.dryCells).toBeGreaterThan(300);expect(report.waterCells).toBeGreaterThan(12);
  expect(report.passageSeconds.lemon).toBeGreaterThan(12);
  expect(report.passageSeconds['boss-carapace']).toBeGreaterThan(75);
  expect(Object.values(report.siteValidity).every(Boolean)).toBe(true);
 });
 it('rejects construction in pillars and reservoirs, keeps visible 2 arches and exit',()=>{
  expect(roadDistance({x:402,y:346})).toBe(0);expect(roadDistance({x:941,y:422})).toBe(0);
  expect(canBuild(map,{x:388,y:254},24)).toBe(false);
  expect(canBuild(map,{x:920,y:318},24)).toBe(false);
  expect(canBuild(map,{x:1070,y:145},24)).toBe(false);
  expect(canBuild(map,positions.reservoirWest,24,'water')).toBe(true);
  expect(canBuild(map,positions.reservoirEast,24,'water')).toBe(true);
  expect(canBuild(map,positions.westHigh,24,'water')).toBe(false);
  for(const [key,p] of Object.entries(positions))if(!key.startsWith('reservoir'))expect(canBuild(map,p,24),key).toBe(true);
 });
 it('matches route vertices to background geometry and has a separate preview/thumbnail',()=>{
  const background=readFileSync(new URL('background.svg',artRoot),'utf8');
  const thumbnail=readFileSync(new URL('thumbnail.svg',artRoot),'utf8');
  const preview=readFileSync(new URL('preview.html',artRoot),'utf8');
  const route=background.match(/<path id="lane" d="([^"]+)"/);
  expect(route).toBeTruthy();
  const vertices=[...route![1].matchAll(/[ML](\d+) (\d+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
  expect(vertices).toEqual(map.lanes[0]);
  expect(thumbnail).toContain('viewBox="0 0 640 360"');
  expect(thumbnail).toContain('xlink:href="#road"');
  expect(preview).toContain('viewBox="0 0 1280 720"');
  expect(preview).toContain('data-view="west"');expect(preview).toContain('data-view="east"');
  expect(background).not.toMatch(/(?:href|src)=["']https?:\/\//);
 });
});

describe('Replay candidates: honest integration boundaries',()=>{
 it('contains 3 different legal plans with viable positions, range and crosspaths',()=>{
  expect(candidates.map(p=>p.modeId)).toEqual(['standard','half-cash','iron-oath']);
  expect(new Set(candidates.map(p=>p.seed)).size).toBe(3);
  const baseRanges:Record<string,number>={needle:160,cannon:170,frost:155,beacon:160,scatter:115,ember:145,saw:115,venom:165,rail:290,tesla:170};
  for(const plan of candidates){
   expect(plan.verification).toBe('unverified');expect(plan.rounds).toBe(40);
   expect(plan.difficulty).toBe('easy');expect(plan.knowledge).toEqual([]);
   expect(plan.unlockedTowers).toEqual(firstArrivalTowers);
   expect(plan.unlockedTowers).not.toContain('mortar');expect(plan.unlockedTowers).not.toContain('observatory');
   const placed=new Map<string,{pos:Vec,tiers:[number,number,number]}>();
   let wave=0,tick=0;
   for(const action of plan.actions){
    expect(action.wave).toBeGreaterThanOrEqual(1);expect(action.wave).toBeLessThanOrEqual(40);
    expect(action.wave>wave||action.wave===wave&&action.tick>=tick).toBe(true);
    wave=action.wave;tick=action.tick;
    if(action.kind==='place'){
     expect(plan.unlockedTowers).toContain(action.tower);expect(placed.has(action.alias)).toBe(false);
     const pos=positions[action.site];expect(canBuild(map,pos,24),action.site).toBe(true);
     expect(roadDistance(pos),`${action.tower} must reach road from ${action.site}`).toBeLessThan(baseRanges[action.tower]);
     expect([...placed.values()].every(other=>Math.hypot(other.pos.x-pos.x,other.pos.y-pos.y)>=48)).toBe(true);
     placed.set(action.alias,{pos,tiers:[0,0,0]});
    }else{
     const tower=placed.get(action.alias);expect(tower).toBeDefined();
     const tiers=tower!.tiers;tiers[action.path]++;
     expect(tiers[action.path]).toBeLessThanOrEqual(5);
     expect(tiers.filter(n=>n>0).length).toBeLessThanOrEqual(2);
     expect(tiers.filter(n=>n>2).length).toBeLessThanOrEqual(1);
    }
   }
  }
 });
 it('has affordable no-pop initial buys for easy and respects half-cash starting credit',()=>{
  const costs:Record<string,number>={needle:250,cannon:550,frost:500,beacon:600,scatter:425,ember:600,saw:650,venom:650,rail:950,tesla:800};
  const openings=candidates.map(plan=>plan.actions.reduce((total,a)=>total+(a.wave===1&&a.kind==='place'?Math.ceil(.85*costs[a.tower]):0),0));
  expect(openings).toEqual([788,426,1000]);
  expect(openings[0]).toBeLessThanOrEqual(1000);expect(openings[1]).toBeLessThanOrEqual(500);expect(openings[2]).toBeLessThanOrEqual(1000);
 });
 it('reports rejected purchases as failed without pretending to win',()=>{
  const plan=candidates[0];
  const state={phase:'build',wave:0,lives:200,credits:1000,towers:[],options:{
   mapId:plan.mapId,difficulty:plan.difficulty,modeId:plan.modeId,seed:plan.seed,knowledge:[],unlockedTowers:[...plan.unlockedTowers],
  }} as unknown as GameState;
  const engine={getSnapshot:()=>state,dispatch:()=>({ok:false,reason:'declined'}),step:()=>{throw Error('Must never run');}} as unknown as GameEngine;
  const result=executeCandidate(engine,plan);
  expect(result.verification).toBe('failed');expect(result.won).toBe(false);
  expect(result.error).toMatch(/Rejected action/);expect(result.receipts).toHaveLength(0);
 });
});
