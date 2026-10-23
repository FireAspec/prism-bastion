import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {GameEngine,GameState,RunOptions} from '../../src/contracts';
import {getMap} from '../../src/content/maps/tidal-docks';
import {analyzeMapGeometry,LAND_SITES,WATER_SITES} from '../../validation/maps/tidal-docks/geometry';
import {replayProgram,runReplay,validateReplayProgram} from '../../validation/maps/tidal-docks/replay';

describe('tidal-docks world geometry',()=>{
  it('preserves frozen MapDef identity, map size, one lane and the progression position',()=>{
    const m=getMap();
    expect([m.id,m.campaignIndex,m.difficulty,m.recommendedDifficulty,m.theme,m.pathWidth]).toEqual(['tidal-docks',8,2,'normal','estuary',52]);
    expect(m.lanes).toHaveLength(1);
    expect(m.lanes[0][0]).toEqual({x:0,y:355});
    expect(m.lanes[0].at(-1)).toEqual({x:1280,y:334});
    expect(m.waveOverrides).toEqual({});
    expect(m.background).toBe('art/maps/tidal-docks/background.svg');
  });
  it('validates polygons, collision buffers, long route, accessible land and water',()=>{
    const r=analyzeMapGeometry();
    expect(r.errors).toEqual([]);
    expect(r.lengthPx).toBeGreaterThan(1800);
    expect(r.lengthPx).toBeLessThan(1950);
    expect(r.minLaneToWaterPx).toBeGreaterThan(29);
    expect(r.minLaneToBlockedPx).toBeGreaterThan(29);
    expect(r.waterFractionSampled).toBeGreaterThan(.45);
    expect(r.traversalSecondsAt120Px).toBeGreaterThan(15);
    expect(r.traversalSecondsAt60Px).toBeGreaterThan(30);
    expect(r.landSites).toBeGreaterThanOrEqual(8);
    expect(r.waterSites).toBeGreaterThanOrEqual(3);
  });
  it('supports two genuinely different nonoverlapping compositions',()=>{
    const site=(id:string)=>LAND_SITES.find(p=>p.id===id)!;
    const compositions=[['W1','C1','E1','E2'],['W2','W3','E3','E4']];
    expect(compositions[0].every(id=>!compositions[1].includes(id))).toBe(true);
    for(const group of compositions){
      const pads=group.map(site);
      for(const [i,p] of pads.entries())for(const q of pads.slice(i+1)){
        expect(Math.hypot(p.pos.x-q.pos.x,p.pos.y-q.pos.y)).toBeGreaterThanOrEqual(p.radius+q.radius);
      }
    }
    expect(WATER_SITES.some(p=>p.id==='T1'&&p.pos.y<320)).toBe(true);
    expect(WATER_SITES.some(p=>p.id==='T2'&&p.pos.y>600)).toBe(true);
  });
  it('does not share mutable arrays between getMap calls',()=>{
    const one=getMap();one.lanes[0][0].x=123;one.water[0][0].y=77;one.blocked[0].pop();
    expect(getMap().lanes[0][0].x).toBe(0);
    expect(getMap().water[0][0].y).toBe(0);
    expect(getMap().blocked[0]).toHaveLength(4);
  });
  it('provides self-contained matching background, thumbnail and preview',()=>{
    const root='public/art/maps/tidal-docks/';
    const bg=readFileSync(`${root}background.svg`,'utf8');
    const thumbnail=readFileSync(`${root}thumbnail.svg`,'utf8');
    const preview=readFileSync(`${root}preview.html`,'utf8');
    expect(bg).toContain('viewBox="0 0 1280 720"');
    expect(thumbnail).toContain('viewBox="0 0 640 360"');
    expect(bg).toContain('id="route"');
    expect(bg).toContain('stroke-width="52"');
    expect(preview).toContain('src="background.svg"');
    expect(preview).toContain('src="thumbnail.svg"');
    expect(`${bg}${thumbnail}${preview}`).not.toMatch(/(?:href|src)="https?:\/\//i);
  });
});

describe('tidal-docks replay integration handoff',()=>{
  it('maintains honest unverified cases with only 18 already unlocked towers',()=>{
    expect(validateReplayProgram()).toEqual([]);
    expect(replayProgram.replayStatus).toBe('unverified');
    expect(replayProgram.profile.unlockedTowers).toHaveLength(18);
    expect(replayProgram.profile.unlockedTowers).not.toContain('harbor');
    expect(replayProgram.profile.knowledge).toEqual([]);
    expect(replayProgram.cases.map(c=>c.modeId)).toEqual(['standard','half-cash','iron-oath']);
    for(const c of replayProgram.cases){expect(c.actions.length).toBeGreaterThanOrEqual(10);expect(c.actions.some(a=>a.wave>=40)).toBe(true);}
  });
  it('runs commands against real price results, and fails rejected purchases (test double only)',()=>{
    const candidate={...replayProgram.cases[0],actions:[
      {wave:1,tick:0,type:'place' as const,site:'W1',position:{x:244,y:362},tower:'needle',bind:'one'},
      {wave:2,tick:0,type:'upgrade' as const,ref:'one',path:0 as const},
    ]};
    const factory=(_o:RunOptions):GameEngine=>{
      let phase:'build'|'wave'|'victory'='build',credits=900,wave=0,tick=0;
      const towers:{id:string}[]=[];
      const getSnapshot=()=>({phase,credits,lives:150,wave,tick,towers:[...towers]}) as unknown as GameState;
      return {getSnapshot,dispatch(a){
        if(a.type==='startWave'){wave++;tick=0;phase='wave';return {ok:true};}
        if(a.type==='place'){if(credits<100)return {ok:false,reason:'cash'};credits-=100;towers.push({id:'t1'});return {ok:true,entity:'t1'};}
        if(a.type==='upgrade'){if(credits<30)return {ok:false,reason:'cash'};credits-=30;return {ok:true};}
        return {ok:false,reason:'unsupported'};
      },step(){tick++;if(tick===2)phase=wave===60?'victory':'build';},drainEvents(){return [];},reassignOwner(){return {ok:false};}};
    };
    const result=runReplay({} as never,factory,candidate);
    expect(result.won).toBe(true); // Demonstrates bridge, NOT actual game victory.
    expect(result.purchases.map(p=>p.cost)).toEqual([100,30]);
    expect(result.finalCredits).toBe(770);
    expect(result.completedWaves).toBe(60);
    const failed=runReplay({} as never,options=>{
      const engine=factory(options);
      return {...engine,dispatch(a){if(a.type==='place')return {ok:false,reason:'insufficient credits'};return engine.dispatch(a);}};
    },candidate);
    expect(failed.won).toBe(false);
    expect(failed.failure).toContain('insufficient credits');
  });
});
