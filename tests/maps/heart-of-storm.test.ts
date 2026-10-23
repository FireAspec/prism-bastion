import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {getMap} from '../../src/content/maps/heart-of-storm';
import {laneLength} from '../../src/contracts/geometry';
import {analyzeGeometry} from '../../validation/maps/heart-of-storm/geometry';

const root=new URL('../../',import.meta.url);
const fixture=JSON.parse(readFileSync(fileURLToPath(new URL('validation/maps/heart-of-storm/replays.json',root)),'utf8'));
const sites=JSON.parse(readFileSync(fileURLToPath(new URL('validation/maps/heart-of-storm/sites.json',root)),'utf8'));
const preview=readFileSync(fileURLToPath(new URL('public/art/maps/heart-of-storm/preview.html',root)),'utf8');

describe('Heart of Storm / final campaign arena',()=>{
  it('declares the 20th extreme estuary without turning map geometry into wave count',()=>{
    const map=getMap();
    expect(map.id).toBe('heart-of-storm');
    expect(map.campaignIndex).toBe(20);
    expect(map.difficulty).toBe(4);
    expect(map.recommendedDifficulty).toBe('extreme');
    expect(map.theme).toBe('estuary');
    expect(map.background).toBe('/art/maps/heart-of-storm/background.svg');
    expect(map).not.toHaveProperty('rounds');
  });

  it('has exactly four fixed entrances, two exits and a long, common last defense',()=>{
    const {lanes}=getMap();
    expect(lanes).toHaveLength(4);
    expect(lanes.map(lane=>lane[0])).toEqual([
      {x:0,y:104},{x:0,y:266},{x:0,y:464},{x:0,y:624},
    ]);
    expect(lanes.map(lane=>lane.at(-1))).toEqual([
      {x:1280,y:211},{x:1280,y:510},{x:1280,y:211},{x:1280,y:510},
    ]);
    expect(lanes.every(lane=>JSON.stringify(lane.slice(7,13))===JSON.stringify(lanes[0].slice(7,13)))).toBe(true);
    expect(laneLength(lanes[0].slice(7,13))).toBeGreaterThan(450);
  });

  it('passes exact segment/polygon clearance and full-footprint site validation',()=>{
    const report=analyzeGeometry();
    expect(report.errors).toEqual([]);
    expect(report.status).toBe('passed');
    expect(report.minPathClearances.every(clearance=>clearance>=21)).toBe(true);
    expect(report.landSites).toBeGreaterThanOrEqual(8);
    expect(report.waterSites).toBeGreaterThanOrEqual(2);
    expect(report.sharedAt132pxPerSec).toBeGreaterThan(3);
  });

  it('fixes the spawn lane per group with explicit warnings, rotating all four entrances',()=>{
    const {waveOverrides}=getMap();
    expect(Object.keys(waveOverrides)).toHaveLength(100);
    const bossIds:Record<number,string>={
      10:'boss-carapace',20:'boss-brood',40:'boss-mirror',
      60:'boss-chrono',80:'boss-tempest',100:'boss-eclipse',
    };
    const bossLanes:Record<number,number>={10:0,20:3,40:2,60:1,80:0,100:3};
    const roster=new Set([
      'scarlet','amber','jade','lemon','violet','iron','glass','cloak','shield',
      'split','regrow','ruby','glacier','copper','dart','obsidian','aegis',
      'swarm','royal','hollow','prismatic','juggernaut','herald',...Object.values(bossIds),
    ]);
    for(let wave=1;wave<=100;wave++) {
      const override=waveOverrides[wave],groups=override.groups;
      expect(groups?.length,wave.toString()).toBeGreaterThanOrEqual(1);
      expect(groups?.some(group=>group.lane===(bossLanes[wave]??(wave-1)%4)),`wave ${wave} has its announced entrance`).toBe(true);
      expect(override.preview).toContain(`Волна ${wave}`);
      expect(override.preview).toContain('Направления фиксированы');
      for(const group of groups??[]) {
        expect(roster.has(group.enemy),`unknown enemy ${group.enemy}`).toBe(true);
        expect(group.lane).toBeGreaterThanOrEqual(0);
        expect(group.lane).toBeLessThan(4);
        expect(group.count).toBeGreaterThan(0);
        expect(Number.isInteger(group.count)).toBe(true);
        expect(group.at).toBeGreaterThanOrEqual(0);
        expect(group.every).toBeGreaterThan(0);
      }
      if(bossIds[wave]) {
        expect(override.boss).toBe(bossIds[wave]);
        expect(groups?.filter(group=>group.enemy===bossIds[wave])).toHaveLength(1);
      } else expect(override.boss).toBeUndefined();
    }
  });

  it('contains only the technologies available before the final medal',()=>{
    const expected=[
      'needle','cannon','frost','beacon','scatter','ember','saw','venom','rail',
      'tesla','mortar','observatory','mint','orchard','drone','rocket','resonator',
      'forge','harbor','tide','coral','chrono','gravity','prism','mirror','mine',
      'portal','bank','storm','bastion',
    ];
    expect(fixture.unlockedTowers).toEqual(expected);
    expect(new Set(expected).size).toBe(30);
    expect(fixture).not.toHaveProperty('unlocks');
  });

  it('keeps three executable replay candidates honestly unverified until combat is integrated',()=>{
    expect(fixture.verification).toBe('unverified');
    expect(fixture.actualFinalLives).toBeNull();
    expect(fixture.actualFinalCredits).toBeNull();
    expect(fixture.difficulty).toBe('extreme');
    expect(fixture.rounds).toBe(100);
    expect(fixture.scenarios.map((s:{modeId:string})=>s.modeId)).toEqual(['standard','half-cash','iron-oath']);
    const catalog=new Set([...sites.land,...sites.water].map((s:{id:string})=>s.id));
    for(const scenario of fixture.scenarios) {
      expect(scenario.seed).toBeGreaterThan(0);
      const placed=new Set<string>(),usedSites=new Set<string>();
      let previous=0;
      for(const action of scenario.actions) {
        expect(action.wave).toBeGreaterThanOrEqual(1);
        expect(action.wave).toBeGreaterThanOrEqual(previous);
        expect(action.wave).toBeLessThanOrEqual(100);
        expect(action.tick).toBeGreaterThanOrEqual(0);
        previous=action.wave;
        if(action.type==='place') {
          expect(fixture.unlockedTowers).toContain(action.tower);
          expect(catalog.has(action.site)).toBe(true);
          expect(usedSites.has(action.site)).toBe(false);
          usedSites.add(action.site);
          placed.add(action.ref);
        } else {
          expect(action.type).toBe('upgrade');
          expect(placed.has(action.ref)).toBe(true);
          expect([0,1,2]).toContain(action.path);
        }
      }
      const beginning=scenario.actions.filter((a:{wave:number})=>a.wave===1);
      const cost=beginning.reduce((sum:number,a:{type:string;tower:string})=>
        sum+(a.type==='place'&&a.tower==='needle'?300:0),0);
      expect(scenario.openingSpend).toBe(cost);
      expect(scenario.openingRemainder).toBe(scenario.startingCredits-cost);
      expect(scenario.openingRemainder).toBeGreaterThanOrEqual(0);
      if(scenario.modeId==='iron-oath') {
        expect(scenario.actions.some((a:{tower?:string})=>['mint','bank','orchard'].includes(a.tower??''))).toBe(false);
      }
    }
  });

  it('keeps preview and gameplay routes in sync and ships standalone artwork',()=>{
    const encoded=preview.match(/<script type="application\/json" id="geometry">([\s\S]*?)<\/script>/)?.[1];
    expect(encoded).toBeTruthy();
    const geometry=JSON.parse(encoded!);
    const map=getMap();
    expect(geometry.lanes).toEqual(map.lanes.map(lane=>lane.map(({x,y})=>[x,y])));
    expect(geometry.land).toEqual(sites.land.map((s:{id:string;x:number;y:number})=>[s.id,s.x,s.y]));
    expect(geometry.water).toEqual(sites.water.map((s:{id:string;x:number;y:number})=>[s.id,s.x,s.y]));
    expect(preview).toContain('data-composition="split"');
    expect(preview).toContain('data-mode="iron-oath"');
    const image=readFileSync(fileURLToPath(new URL('public/art/maps/heart-of-storm/background.svg',root)),'utf8');
    const thumb=readFileSync(fileURLToPath(new URL('public/art/maps/heart-of-storm/thumbnail.svg',root)),'utf8');
    expect(image).toContain('viewBox="0 0 1280 720"');
    expect(thumb).toContain('viewBox="0 0 640 360"');
    expect(image).not.toContain('<script');
    expect(thumb).not.toContain('<script');
    expect(image).not.toBe(thumb);
    for(const asset of [image,thumb,preview]) {
      expect(asset).not.toMatch(/(?:src|href)=["']https?:\/\//);
    }
  });
});
