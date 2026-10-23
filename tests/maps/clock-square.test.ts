import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {getMap} from '../../src/content/maps/clock-square';
import {distanceToSegment} from '../../src/contracts/geometry';
import {analyzeMap,buildSites,siteClearance} from '../../validation/maps/clock-square/geometry';
import {firstArrivalTowers,replayCandidates,validateReplayCandidates} from '../../validation/maps/clock-square/replays';

const file=(name:string)=>readFileSync(fileURLToPath(new URL('../../public/art/maps/clock-square/'+name,import.meta.url)),'utf8');
const numbers=(value:string)=>(value.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number);
const positions=(points:{x:number;y:number}[])=>points.flatMap(p=>[p.x,p.y]);
const route=(html:string,kind:string)=>{
 const match=html.match(new RegExp('class="road '+kind+'" d="([^"]+)"'));
 expect(match).not.toBeNull();
 return numbers(match![1]);
};
describe('clock-square map identity',()=>{
 it('uses exactly the mandated campaign slot and shared visible exit',()=>{
  const m=getMap();
  expect(m).toMatchObject({id:'clock-square',difficulty:3,campaignIndex:11,recommendedDifficulty:'hard',
   theme:'foundry',pathWidth:44,background:'/art/maps/clock-square/background.svg',waveOverrides:{}});
  expect(m.lanes).toHaveLength(2);
  expect(m.lanes.map(l=>l[0])).toEqual([{x:0,y:156},{x:0,y:563}]);
  expect(m.lanes.map(l=>l.at(-1))).toEqual([{x:1280,y:360},{x:1280,y:360}]);
  expect(m.lanes.map(l=>l.at(-2))).toEqual([{x:1100,y:360},{x:1100,y:360}]);
  expect(m.lanes.every(l=>l.some(p=>p.x===654&&p.y===361))).toBe(true);
 });
 it('passes an independent collision and bounds analyzer',()=>{
  const r=analyzeMap();
  expect(r.errors).toEqual([]);expect(r.valid).toBe(true);
  expect(r.lengths.every(n=>n>1600)).toBe(true);
  expect(r.minimumRoadToPolygonClearance).toBeGreaterThan(40);
  expect(r.traversalSecondsAt200.every(t=>t>8)).toBe(true);
  expect(r.sites.every(s=>s.valid)).toBe(true);
 });
 it('analyzer catches introduced collapsed lane and broken polygon',()=>{
  const m=getMap();
  m.lanes[0][3]={...m.lanes[0][2]};
  m.blocked[0][0]={x:1300,y:93};
  const problems=analyzeMap(m).errors.join('; ');
  expect(problems).toContain('zero length');
  expect(problems).toContain('outside the world');
 });
 it('has dry launch positions, an offset center and future naval sites',()=>{
  const m=getMap();
  expect(buildSites.filter(s=>s.terrain==='land')).toHaveLength(10);
  expect(buildSites.filter(s=>s.terrain==='water')).toHaveLength(2);
  for(const site of buildSites)expect(siteClearance(site,m)).toBeGreaterThanOrEqual(site.radius);
  const p=buildSites.find(s=>s.id==='cross-north')!.pos;
  expect(m.lanes.every(l=>l.slice(1).some((pt,i)=>distanceToSegment(p,l[i],pt)<150))).toBe(true);
  expect(m.lanes.every(l=>distanceToSegment(p,l[0],l[1])>350)).toBe(true);
 });
 it('returns independent mutable copies of every geometry collection',()=>{
  const a=getMap();a.lanes[0][0].y=999;a.blocked[0][0].x=999;a.water[0][0].x=999;a.waveOverrides[9]={reward:999};
  const b=getMap();expect(b.lanes[0][0].y).toBe(156);
  expect(b.blocked[0][0].x).toBe(557);expect(b.water[0][0].x).toBe(806);
  expect(b.waveOverrides).toEqual({});
 });
});
describe('clock-square art',()=>{
 it('keeps preview and thumbnail geometry equal to MapDef routes',()=>{
  const m=getMap(),html=file('preview.html'),thumb=file('thumbnail.svg');
  expect(route(html,'north')).toEqual(positions(m.lanes[0]));
  expect(route(html,'south')).toEqual(positions(m.lanes[1]));
  expect(thumb).toContain('d="M0 156L95 156L155 115L265 105L354 143L389 218L355 278L438 338L555 372L654 361L745 414L788 498L875 525L965 500L1010 436L1028 379L1100 360L1280 360"');
  expect(thumb).toContain('d="M0 563L100 563L163 607L270 613L358 565L387 492L351 435L437 379L555 344L654 361L748 310L786 225L878 196L962 225L1009 291L1028 350L1100 360L1280 360"');
 });
 it('uses offline, scalable standalone SVG and an interactive preview',()=>{
  const bg=file('background.svg'),thumb=file('thumbnail.svg'),preview=file('preview.html');
  expect(bg).toContain('width="1280" height="720" viewBox="0 0 1280 720"');
  expect(thumb).toContain('width="640" height="360" viewBox="0 0 1280 720"');
  for(const svg of [bg,thumb]){
   expect(svg).not.toMatch(/<script|<foreignObject|<image\s|href="https?:|data:image/i);
   expect(svg).toContain('</svg>');
  }
  expect(preview).toContain('./background.svg');
  expect(preview).toContain('data-layer="roads"');
  expect(preview).not.toMatch(/(?:src|href)="https?:\/\//);
 });
});
describe('clock-square honest replay fixtures',()=>{
 it('contains three legal yet unverified hard candidates',()=>{
  expect(validateReplayCandidates()).toEqual([]);
  expect(replayCandidates.map(p=>p.modeId)).toEqual(['standard','half-cash','iron-oath']);
  expect(replayCandidates.every(p=>p.status==='unverified'&&p.rounds===80&&p.knowledge.length===0)).toBe(true);
  expect(firstArrivalTowers).toHaveLength(21);
  expect(firstArrivalTowers).not.toContain('chrono');
  expect(replayCandidates[0].steps.some(s=>s.tick>0)).toBe(true);
 });
 it('does not double-count gross round rewards in half-cash',()=>{
  const [standard,half,iron]=replayCandidates;
  expect([standard.grossRewardOnly(1),half.grossRewardOnly(1),iron.grossRewardOnly(1)]).toEqual([850,425,850]);
  expect([standard.grossRewardOnly(11),half.grossRewardOnly(11),iron.grossRewardOnly(11)]).toEqual([1615,807,1615]);
  expect(half.grossRewardOnly(21)).toBe(1340);
  expect(standard.grossRewardOnly(41)).toBe(5710);
 });
});
