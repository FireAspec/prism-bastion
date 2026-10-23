import {describe,expect,it} from 'vitest';
import {getMap} from '../../src/content/maps/black-lighthouse';
import {laneLength} from '../../src/contracts/geometry';
import {auditGeometry,canPlace,clearanceFromRoad,sites} from '../../validation/maps/black-lighthouse/geometry';
import {auditCandidates,estimatedBudget,makeRunOptions,replayCandidates,storyTowers} from '../../validation/maps/black-lighthouse/replays';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

describe('Black Lighthouse (campaign map 19)',()=>{
  it('uses the frozen content schema with the correct campaign contract',()=>{
    const map=getMap();
    expect(map).toMatchObject({id:'black-lighthouse',difficulty:4,campaignIndex:19,
      recommendedDifficulty:'extreme',theme:'estuary',pathWidth:38,
      background:'/art/maps/black-lighthouse/background.svg',waveOverrides:{}});
    expect(map.lanes).toHaveLength(3);
    expect(map.water.length).toBeGreaterThanOrEqual(3);
  });
  it('returns a new object graph, safe from editor/engine mutation',()=>{
    const a=getMap(),b=getMap();
    a.lanes[0][0].x=999;a.water[0][0].y=1000;a.blocked.pop();
    expect(b.lanes[0][0].x).toBe(0);
    expect(b.water[0][0].y).toBe(0);
    expect(b.blocked).toHaveLength(5);
  });
  it('validates non-degenerate paths, simple polygons and legal site footprints',()=>{
    const report=auditGeometry(getMap());
    expect(report.errors).toEqual([]);
    expect(report.sites).toHaveLength(sites.length);
    expect(report.sites.every(s=>s.valid)).toBe(true);
  });
  it('joins all three lanes and provides a substantial final shared section',()=>{
    const lanes=getMap().lanes;
    for(const lane of lanes){
      expect(lane.slice(-3)).toEqual([{x:972,y:357},{x:1140,y:357},{x:1280,y:357}]);
      expect(laneLength(lane.slice(-3))).toBe(308);
      expect(laneLength(lane)).toBeGreaterThan(1300);
    }
  });
  it('rejects entire footprints touching a road, water boundary or blocked area',()=>{
    const map=getMap();
    expect(clearanceFromRoad(map,{x:1030,y:357})).toBe(-19);
    expect(canPlace(map,{x:1030,y:357},24,'land')).toBe(false);
    expect(canPlace(map,{x:1135,y:220},24,'land')).toBe(false);
    expect(canPlace(map,{x:130,y:224},22,'land')).toBe(false);
    expect(canPlace(map,{x:130,y:224},22,'water')).toBe(true);
    expect(canPlace(map,{x:592,y:457},22,'water')).toBe(true);
    expect(canPlace(map,{x:592,y:457},50,'water')).toBe(false);
    expect(canPlace(map,{x:2,y:35},24,'water')).toBe(false);
  });
  it('detects moved illegal hardpoints and malformed geometry without hiding them',()=>{
    const map=getMap();
    map.lanes[0][1]={...map.lanes[0][0]};
    map.water[1][2]={x:1400,y:210};
    const report=auditGeometry(map);
    expect(report.errors.some(e=>e.includes('zero-length'))).toBe(true);
    expect(report.errors.some(e=>e.includes('outside world'))).toBe(true);
  });
  it('keeps three executable replay candidates explicitly unverified and legal',()=>{
    expect(auditCandidates()).toEqual([]);
    expect(replayCandidates.map(c=>c.modeId)).toEqual(['standard','half-cash','iron-oath']);
    for(const plan of replayCandidates){
      expect(plan.status).toBe('unverified');
      expect(plan.victory).toBeNull();
      expect(makeRunOptions(plan).knowledge).toEqual([]);
      expect(makeRunOptions(plan).unlockedTowers).toEqual(storyTowers);
      expect(makeRunOptions(plan).unlockedTowers).not.toContain('bastion');
      expect(estimatedBudget(plan).at(-1)?.layerCashNeeded).toBeGreaterThan(0);
    }
    expect(replayCandidates.find(p=>p.modeId==='half-cash')?.openingCredits).toBe(425);
  });
  it('keeps diagnostic preview road curves synchronized with the runtime MapDef',()=>{
    const preview=readFileSync(fileURLToPath(new URL('../../public/art/maps/black-lighthouse/preview.html',import.meta.url)),'utf8');
    const roadPoints=[...preview.matchAll(/<polyline class="route-base" points="([^"]+)"/g)].map(match=>match[1]);
    const asPoints=(path:{x:number;y:number}[])=>path.map(p=>`${p.x},${p.y}`).join(' ');
    const map=getMap();
    expect(roadPoints).toHaveLength(4);
    map.lanes.forEach((lane,i)=>expect(roadPoints[i]).toBe(asPoints(lane.slice(0,-2))));
    expect(roadPoints[3]).toBe(asPoints(map.lanes[0].slice(-3)));
    expect(preview).toContain('src="./background.svg"');
    expect(preview).toContain('id="toggle-routes"');
    expect(preview).toContain('id="toggle-sites"');
  });
  it('includes two standalone local SVG assets with no external resources',()=>{
    for(const name of ['background.svg','thumbnail.svg']){
      const svg=readFileSync(fileURLToPath(new URL(`../../public/art/maps/black-lighthouse/${name}`,import.meta.url)),'utf8');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).not.toMatch(/<script|<foreignObject|(?:href|url)\s*=\s*["']https?:/i);
      expect(svg).not.toContain('background.svg"');
    }
  });
  it('makes the preview route and site switches actually toggle the corresponding layers',()=>{
    const html=readFileSync(fileURLToPath(new URL('../../public/art/maps/black-lighthouse/preview.html',import.meta.url)),'utf8');
    const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    const handles=new Map<string,{attrs:Record<string,string>;style:{display:string};click?:()=>void}>();
    for(const id of ['toggle-routes','toggle-sites','routes','sites'])
      handles.set(id,{attrs:{'aria-pressed':'true'},style:{display:''}});
    const document={getElementById:(id:string)=>{
      const handle=handles.get(id);
      if(!handle)throw new Error(`Unknown UI id ${id}`);
      return {...handle,getAttribute:(key:string)=>handle.attrs[key],
        setAttribute:(key:string,value:string)=>{handle.attrs[key]=value;},
        addEventListener:(_event:string,listener:()=>void)=>{handle.click=listener;}};
    }};
    runInNewContext(script!,{document});
    handles.get('toggle-routes')!.click!();
    expect(handles.get('routes')!.style.display).toBe('none');
    expect(handles.get('sites')!.style.display).toBe('');
    handles.get('toggle-routes')!.click!();
    expect(handles.get('routes')!.style.display).toBe('');
    handles.get('toggle-sites')!.click!();
    expect(handles.get('sites')!.style.display).toBe('none');
  });
});
