import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {getMap,BELL_FOUNDRY_SITES} from '../../src/content/maps/bell-foundry';
import {analyzeBellFoundry} from '../../validation/maps/bell-foundry/check';
import {FIRST_ARRIVAL_TOWERS,replayCandidates,inspectCandidate,executeReplay,guaranteedBudgetBeforeWave,type ReplayAdapter} from '../../validation/maps/bell-foundry/replay';
const asset=(name:string)=>readFileSync(fileURLToPath(new URL(`../../public/art/maps/bell-foundry/${name}`,import.meta.url)),'utf8');

describe('Bell Foundry world geometry',()=>{
  it('matches the frozen MapDef shape without leaking progress or changing difficulty rounds',()=>{
    const map=getMap();
    expect(map).toMatchObject({id:'bell-foundry',campaignIndex:7,difficulty:2,recommendedDifficulty:'normal',theme:'foundry',pathWidth:46});
    expect(map.name).toBe('Колокольная литейная');expect(map.description).toContain('кузню');
    expect(map.background).toBe('/art/maps/bell-foundry/background.svg');expect(map.waveOverrides).toEqual({});
    expect(map).not.toHaveProperty('rounds');expect(map).not.toHaveProperty('unlocks');
    expect(map.lanes.map(lane=>lane.at(-1))).toEqual([{x:0,y:579},{x:0,y:579},{x:0,y:579}]);
  });
  it('returns new geometry values on every request',()=>{
    const a=getMap();a.lanes[0][1].x=-5;a.blocked[0][0].x=-5;a.water[0][0].x=-5;a.waveOverrides[10]={preview:'fake'};
    const b=getMap();expect(b.lanes[0][1].x).toBe(888);expect(b.blocked[0][0].x).toBe(976);
    expect(b.water[0][0].x).toBe(402);expect(b.waveOverrides).toEqual({});
  });
  it('passes independent segment/polygon/footprint checks',()=>{
    const report=analyzeBellFoundry();expect(report.errors).toEqual([]);expect(report.ok).toBe(true);
    expect(report.hairpins).toBe(3);expect(report.laneLengths).toEqual([3565,3639,1453.7]);
    expect(report.secondsAt132[2]).toBeGreaterThanOrEqual(11);
    expect(report.landPads).toBe(12);expect(report.waterPads).toBe(2);
    expect(report.minTerrainGap).toBeGreaterThanOrEqual(15);
    expect(new Set(BELL_FOUNDRY_SITES.map(s=>s.id)).size).toBe(14);
  });
  it('has visible art matching the world geometry and no external dependencies',()=>{
    const bg=asset('background.svg'),thumb=asset('thumbnail.svg'),html=asset('preview.html');
    expect(bg).toContain('viewBox="0 0 1280 720"');
    expect(bg).toContain('M0 150H888V287H255V431H935V579H0');
    expect(bg).toContain('M0 76H193V150M1280 350H1050L935 431');
    expect(bg).toContain('M402 642L554 631L601 648L591 702L412 701Z');
    expect(bg).toContain('M653 632L805 635L822 675L795 704L648 696Z');
    expect(thumb).toContain('viewBox="0 0 640 360"');
    expect(thumb).not.toContain('background.svg');
    expect(html).toContain('src="thumbnail.svg"');expect(html).toContain('src="background.svg"');
    expect(html).toContain('id="crossfire"');expect(html).toContain('id="reserve"');
    for(const svg of [bg,thumb])expect(svg).not.toMatch(/<(?:script|foreignObject)\b|href=["']https?:/i);
    expect(html).not.toMatch(/<script\s+src=|<link\b[^>]*href=["']https?:/i);
  });
});

describe('Executable candidates are explicitly unverified',()=>{
  it('only offers the sixteen first-arrival towers, never the reward',()=>{
    expect(FIRST_ARRIVAL_TOWERS).toHaveLength(16);
    expect(FIRST_ARRIVAL_TOWERS).not.toContain('resonator');expect(FIRST_ARRIVAL_TOWERS).not.toContain('forge');
  });
  it('checks schedules, budgets, variety, and the lack of simulated victory claims',()=>{
    expect(replayCandidates.map(c=>c.run.modeId)).toEqual(['standard','half-cash','iron-oath']);
    expect(guaranteedBudgetBeforeWave(1,'standard')).toBe(900);
    expect(guaranteedBudgetBeforeWave(11,'half-cash')).toBe(960);
    for(const c of replayCandidates){
      expect(inspectCandidate(c)).toEqual([]);expect(c.verificationStatus).toBe('unverified');
      expect(c.expectedVictory).toBeNull();expect(c.finalLives).toBeNull();expect(c.finalCredits).toBeNull();
      expect(c.run.knowledge).toEqual([]);expect(c.run.unlockedTowers).toEqual(FIRST_ARRIVAL_TOWERS);
      expect(c.actions.length).toBeGreaterThanOrEqual(13);expect(c.counterplay.length).toBeGreaterThanOrEqual(3);
    }
    expect(replayCandidates[2].actions.every(a=>a.kind==='upgrade'||!['mint','orchard'].includes(a.towerId))).toBe(true);
  });
  it('delegates purchases, 60 waves and final outcome to a runner without faking simulation',async()=>{
    const c=replayCandidates[0],steps:string[]=[];
    const adapter:ReplayAdapter={
      start(run){steps.push(`start:${run.runId}`);},
      action(a,pos){steps.push(`action:${a.wave}`);if(a.kind==='build')expect(pos).toEqual(BELL_FOUNDRY_SITES.find(s=>s.id===a.siteId)?.pos);return {ok:true};},
      finishWave(wave){steps.push(`wave:${wave}`);},
      result(){return {victory:false,lives:0,credits:0,completedWaves:0};},
    };
    const report=await executeReplay(c,adapter);
    expect(report.applied).toBe(c.actions.length);expect(report.rejected).toEqual([]);
    expect(report.final.victory).toBe(false);
    expect(steps.indexOf('action:1')).toBeLessThan(steps.indexOf('wave:1'));
    expect(steps.filter(s=>s.startsWith('wave:'))).toHaveLength(60);
  });
});
