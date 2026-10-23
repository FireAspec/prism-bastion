import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {GameEngine} from '../../src/contracts';
import {getMap} from '../../src/content/maps/glass-switchback';
import {analyzeMap,legalSite,sites,segmentDistance,validatePolygon} from '../../validation/maps/glass-switchback/geometry';
import {analyzeCandidates} from '../../validation/maps/glass-switchback/analyze';
import {optionsFor,runCandidate,type ReplayFixture} from '../../validation/maps/glass-switchback/replay';
import fixture from '../../validation/maps/glass-switchback/replay-candidates.json';

const data=fixture as ReplayFixture;
const dir=new URL('../../public/art/maps/glass-switchback/',import.meta.url);

describe('15 — Стеклянный серпантин',()=>{
 it('has the correct campaign slot and hard/80-wave baseline',()=>{
  const map=getMap();
  expect(map.id).toBe('glass-switchback');
  expect(map.campaignIndex).toBe(15);
  expect(map.difficulty).toBe(3);
  expect(map.recommendedDifficulty).toBe('hard');
  expect(map.waveOverrides).toEqual({});
  expect(map.background).toBe('/art/maps/glass-switchback/background.svg');
 });
 it('keeps the complete road in 1280×720 with four true hairpin reversals',()=>{
  const result=analyzeMap();
  expect(result.errors).toEqual([]);
  expect(result.horizontalReversals).toBe(4);
  expect(result.pathLength).toBeGreaterThan(3400);
  expect(result.pathLength).toBeLessThan(3600);
  expect(result.longestStraight).toBeGreaterThan(800);
  expect(result.minSeparated).toBeGreaterThan(getMap().pathWidth*2);
 });
 it('provides four nondegenerate water and four blocked areas, all clear of the road',()=>{
  const map=getMap();
  expect(map.water).toHaveLength(4);
  expect(map.blocked).toHaveLength(4);
  map.water.forEach((p,i)=>expect(validatePolygon(p,`pool${i}`)).toEqual([]));
  map.blocked.forEach((p,i)=>expect(validatePolygon(p,`cliff${i}`)).toEqual([]));
 });
 it('rejects illegal circle placements, including the center of the road and narrow pool edges',()=>{
  expect(legalSite({x:640,y:126},26,'land')).toBe(false);
  expect(legalSite({x:1104,y:183},24,'land')).toBe(false);
  expect(legalSite({x:1104,y:183},24,'water')).toBe(true);
  expect(legalSite({x:947,y:195},26,'water')).toBe(false);
  expect(legalSite({x:400,y:400},50,'land')).toBe(false);
  expect(legalSite({x:4,y:4},26,'land')).toBe(false);
 });
 it('offers ten valid named tactical sites, including water and land',()=>{
  expect(sites).toHaveLength(10);
  for(const s of sites)expect(legalSite(s.pos,s.radius,s.surface),s.id).toBe(true);
  expect(sites.filter(s=>s.surface==='water')).toHaveLength(3);
 });
 it('calculates touching segments without inventing passage clearance',()=>{
  expect(segmentDistance({x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0})).toBe(0);
  expect(segmentDistance({x:0,y:0},{x:10,y:0},{x:0,y:20},{x:10,y:20})).toBe(20);
 });
 it('ships a locally self-contained layered SVG artwork and matching thumbnail',()=>{
  for(const name of ['background.svg','thumbnail.svg']){
   const svg=readFileSync(new URL(name,dir),'utf8');
   expect(svg).toContain('viewBox=');
   expect(svg).toMatch(/<svg\b/);
   expect(svg.replace('http://www.w3.org/2000/svg','')).not.toMatch(/<script\b|https?:\/\/|<image\b/i);
  }
 });
 it('keeps the preview geometry byte-independent but value-identical to MapDef',()=>{
  const html=readFileSync(new URL('preview.html',dir),'utf8');
  const raw=html.match(/<script id="map-geometry" type="application\/json">([\s\S]*?)<\/script>/);
  expect(raw).not.toBeNull();
  const geometry=JSON.parse(raw![1]);
  const map=getMap();
  expect(geometry).toEqual({lanes:map.lanes,pathWidth:map.pathWidth,water:map.water,blocked:map.blocked});
  expect(html).toContain('id="overlay"');
  expect(html).toContain('id="defense"');
  expect(html).toContain('id="hybrid"');
 });
 it('has three distinct, explicitly unverified 80-wave plans and exactly the 25 legal tower unlocks',()=>{
  expect(data.rounds).toBe(80);
  expect(data.availableAtFirstArrival).toHaveLength(25);
  expect(data.availableAtFirstArrival).not.toContain('mine');
  expect(data.candidates.map(c=>c.modeId)).toEqual(['standard','half-cash','iron-oath']);
  for(const c of data.candidates)expect(c.status).toBe('unverified');
  expect(analyzeCandidates(data).errors).toEqual([]);
 });
 it('respects the actual opening cash, forbids pre-unlocked mine, and prepares a seed-stable run',()=>{
  const standard=data.candidates[0],half=data.candidates[1],iron=data.candidates[2];
  expect(standard.actions.reduce((n,a)=>n+(a.type==='place'&&a.beforeWave===1?a.baseHardCost:0),0)).toBe(743);
  expect(half.startingCredits).toBe(425);
  expect(half.actions.reduce((n,a)=>n+(a.type==='place'&&a.beforeWave===1?a.baseHardCost:0),0)).toBe(275);
  expect(iron.startingLives).toBe(1);
  expect(optionsFor(data,iron).unlockedTowers).not.toContain('mine');
  expect(optionsFor(data,iron).knowledge).toEqual([]);
  expect(iron.actions.some(a=>a.type==='place'&&['mint','orchard','bank'].includes(a.tower))).toBe(false);
 });
 it('stops the replay on the very first rejected purchase; no synthetic victories',()=>{
  const candidate=data.candidates[1];
  const game={
   getSnapshot:()=>({options:optionsFor(data,candidate),phase:'build',credits:425,lives:100,wave:0,tick:0}),
   dispatch:()=>({ok:false,reason:'insufficient funds'})
  } as unknown as GameEngine;
  const result=runCandidate(game,candidate);
  expect(result.won).toBe(false);
  expect(result.status).toBe('blocked');
  expect(result.rejectedActions).toBe(1);
  expect(result.actionsDispatched).toBe(1);
  expect(result.reason).toMatch(/insufficient funds/);
 });
});
