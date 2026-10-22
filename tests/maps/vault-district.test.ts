import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getMap} from '../../src/content/maps/vault-district';
import {laneLength} from '../../src/contracts/geometry';
import {analyseGeometry,LAND_SITES,WATER_SITES,isBuildableLand,isBuildableWater} from '../../validation/maps/vault-district/geometry';
import {activeLaneIndices,activeLanePreview} from '../../validation/maps/vault-district/active-lanes';
import type {WaveDef} from '../../src/contracts';

const fixture=JSON.parse(readFileSync(new URL('../../validation/maps/vault-district/replay-fixtures.json',import.meta.url),'utf8'));
const art=(filename:string)=>readFileSync(new URL('../../public/art/maps/vault-district/'+filename,import.meta.url),'utf8');

describe('map 17 / vault district',()=>{
  it('exposes frozen contract-compatible map metadata with independent copies',()=>{
    const a=getMap(),b=getMap();
    expect([a.id,a.name,a.theme,a.difficulty,a.campaignIndex,a.recommendedDifficulty])
      .toEqual(['vault-district','Квартал хранилищ','foundry',4,17,'extreme']);
    expect(a.pathWidth).toBe(44);
    expect(a.background).toBe('/art/maps/vault-district/background.svg');
    expect(a.waveOverrides).toEqual({});
    a.lanes[0][0].y=99;
    expect(b.lanes[0][0].y).toBe(136);
  });
  it('passes geometric validation: 3 separate border routes, no blocked/water overlap',()=>{
    const report=analyseGeometry();
    expect(report.errors).toEqual([]);
    expect(report.status).toBe('pass');
    expect(report.laneLengths).toEqual([1628,1607,1643]);
    expect(report.routes.every(r=>r.minBlockedClearance>getMap().pathWidth/2+4)).toBe(true);
    expect(report.routes.every(r=>r.minWaterClearance>getMap().pathWidth/2+4)).toBe(true);
    expect(report.fastestTravelSeconds.every(t=>t>11)).toBe(true);
    expect(getMap().lanes.every(l=>laneLength(l)>1400)).toBe(true);
  });
  it('allows four distinct courts, reserves and water-capable platforms',()=>{
    const map=getMap();
    expect(Object.values(LAND_SITES).every(p=>isBuildableLand(map,p,24))).toBe(true);
    expect(Object.values(WATER_SITES).every(p=>isBuildableWater(map,p,20))).toBe(true);
    expect(Object.keys(LAND_SITES).length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(WATER_SITES)).toHaveLength(3);
    const courts=['north','west','east','south'] as const;
    for(const key of courts){
      const {x,y}=LAND_SITES[key];
      expect(map.blocked.every(poly=>!poly.some(v=>v.x===x&&v.y===y))).toBe(true);
    }
  });
  it('offers two visibly different compositions with legal non-overlapping footprints',()=>{
    const map=getMap();
    expect(fixture.status).toBe('unverified');
    expect(fixture.plans.map((p:{modeId:string})=>p.modeId)).toEqual(['standard','half-cash','iron-oath']);
    const fingerprints=new Set<string>();
    for(const plan of fixture.plans){
      const aliases=new Set<string>(),used:{x:number;y:number}[]=[];
      let lastWave=0;
      for(const a of plan.actions){
        expect(a.wave).toBeGreaterThanOrEqual(lastWave);
        expect(a.wave).toBeLessThanOrEqual(100);
        expect(a.tick).toBe(0);
        lastWave=a.wave;
        if(a.type==='place'){
          expect(plan.unlockedTowers).toContain(a.tower);
          expect(fixture.lockedUntilClear).not.toContain(a.tower);
          expect(aliases.has(a.alias)).toBe(false);
          aliases.add(a.alias);
          const onWater=['harbor','tide','coral'].includes(a.tower);
          expect(onWater?isBuildableWater(map,a.pos,20):isBuildableLand(map,a.pos,24)).toBe(true);
          for(const p of used)expect(Math.hypot(p.x-a.pos.x,p.y-a.pos.y)).toBeGreaterThanOrEqual(48);
          used.push(a.pos);
        }else if(a.type==='upgrade'){
          expect(aliases.has(a.alias)).toBe(true);
          expect([0,1,2]).toContain(a.path);
        }else throw new Error('unknown replay action');
      }
      fingerprints.add(plan.actions.filter((a:{type:string})=>a.type==='place')
        .map((a:{tower:string})=>a.tower).join('/'));
      const wave1=plan.actions.filter((a:{wave:number;type:string})=>a.wave===1&&a.type==='place');
      const openingCost=wave1.reduce((n:number,a:{tower:string})=>n+Math.ceil(
        ({needle:250,cannon:550,frost:500,scatter:425}[a.tower as 'needle'|'cannon'|'frost'|'scatter']??100000)*1.2),0);
      expect(openingCost).toBeLessThanOrEqual(plan.modeId==='half-cash'?425:850);
      if(plan.modeId==='iron-oath')
        expect(plan.actions.every((a:{type:string;tower?:string})=>a.type!=='sell'&&
          !['mint','orchard','bank'].includes(a.tower??''))).toBe(true);
    }
    expect(fingerprints.size).toBeGreaterThan(1);
  });
  it('renders truthful active-lane warnings from source groups, not invented markers',()=>{
    const group=(lane:number)=>({enemy:'amber',count:2,at:1,every:1,lane});
    const wave:WaveDef={number:55,preview:'Обход сейфа',reward:190,groups:[group(2),group(0),group(2)]};
    expect(activeLaneIndices(wave)).toEqual([0,2]);
    expect(activeLanePreview(wave)).toContain('северная эстакада');
    expect(activeLanePreview(wave)).toContain('нижний рельсовый тракт');
    expect(activeLanePreview(wave)).not.toContain('грузовой объезд');
    expect(()=>activeLanePreview({...wave,groups:[]})).toThrow('no active routes');
  });
  it('keeps standalone vector artwork aligned with coordinates and preview layers',()=>{
    const map=getMap();
    const background=art('background.svg'),thumbnail=art('thumbnail.svg'),preview=art('preview.html');
    expect(background).toContain('viewBox="0 0 1280 720"');
    expect(background).toContain('РЕЗЕРВ • 07');
    expect(background.match(/data-pad="/g)).toHaveLength(4);
    expect(thumbnail).toContain('КВАРТАЛ ХРАНИЛИЩ');
    expect(thumbnail).not.toBe(background);
    expect(preview).toContain('./background.svg');
    expect(preview).toContain('showPlan');
    for(const lane of map.lanes){
      const line=lane.map(p=>p.x+' '+p.y).join(' L ');
      const overlay=lane.map(p=>p.x+','+p.y).join(' ');
      expect(background).toContain('M '+line);
      expect(preview).toContain('points="'+overlay+'"');
    }
  });
});
