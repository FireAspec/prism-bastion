import {fileURLToPath} from 'node:url';
import {getMap} from '../../../src/content/maps/salt-marsh';
import {distance,distanceToSegment,laneLength,pointInPolygon,pointOnLane} from '../../../src/contracts/geometry';
import {WORLD,type MapDef,type Vec} from '../../../src/contracts';

/** Conservative clearance model; actual tower footprints are checked by engine. */
export const LAND_FOOTPRINT=40;
export const WATER_FOOTPRINT=25;
export const MARGIN=8;
export const SITES={
 northApproach:{x:244,y:91},southApproach:{x:248,y:586},
 northMiddle:{x:606,y:110},southMiddle:{x:614,y:594},
 northConfluence:{x:1065,y:244},southConfluence:{x:1070,y:478},
 exitCrossfire:{x:1180,y:466},exitOverlook:{x:1197,y:253},
} as const satisfies Record<string,Vec>;
export const WATER_SITES={westernChannel:{x:420,y:356},easternChannel:{x:861,y:363}} as const;
export const COMPOSITIONS={
 distributed:['northApproach','southApproach','northMiddle','southMiddle','exitCrossfire'],
 chokepoint:['northConfluence','southConfluence','exitCrossfire','exitOverlook'],
} as const;

const EPS=1e-7;
const orient=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const inBounds=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=WORLD.width&&p.y>=0&&p.y<=WORLD.height;
function onSegment(p:Vec,a:Vec,b:Vec):boolean {
 return Math.abs(orient(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
}
export function segmentsIntersect(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
 const x=orient(a,b,c),y=orient(a,b,d),u=orient(c,d,a),v=orient(c,d,b);
 if(((x>EPS&&y<-EPS)||(x<-EPS&&y>EPS))&&((u>EPS&&v<-EPS)||(u<-EPS&&v>EPS)))return true;
 return onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
function segmentDistance(a:Vec,b:Vec,c:Vec,d:Vec):number {
 if(segmentsIntersect(a,b,c,d))return 0;
 return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
const edges=(poly:Vec[]):[Vec,Vec][]=>(poly.map((p,i)=>[p,poly[(i+1)%poly.length]]));
export function pointToPolygonDistance(p:Vec,poly:Vec[]):number {
 if(pointInPolygon(p,poly))return 0;
 return Math.min(...edges(poly).map(([a,b])=>distanceToSegment(p,a,b)));
}
export function pointToLaneDistance(p:Vec,lane:Vec[]):number {
 return Math.min(...lane.slice(1).map((q,i)=>distanceToSegment(p,lane[i],q)));
}
export function canPlace(map:MapDef,p:Vec,radius:number,terrain:'land'|'water'):boolean {
 if(p.x<radius||p.y<radius||p.x>WORLD.width-radius||p.y>WORLD.height-radius)return false;
 if(map.lanes.some(lane=>pointToLaneDistance(p,lane)<radius+map.pathWidth/2+MARGIN))return false;
 if(map.blocked.some(poly=>pointToPolygonDistance(p,poly)<radius+MARGIN))return false;
 if(terrain==='land')return map.water.every(poly=>pointToPolygonDistance(p,poly)>=radius+MARGIN);
 return map.water.some(poly=>pointInPolygon(p,poly)&&Math.min(...edges(poly).map(([a,b])=>distanceToSegment(p,a,b)))>=radius+MARGIN);
}
const area=(poly:Vec[])=>Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p.x*q.y-q.x*p.y;},0))/2;
function selfCross(poly:Vec[]):boolean {
 const e=edges(poly);
 for(let i=0;i<e.length;i++)for(let j=i+1;j<e.length;j++){
  if(j===i+1||(i===0&&j===e.length-1))continue;
  if(segmentsIntersect(...e[i],...e[j]))return true;
 }
 return false;
}
function blockedOverlapsLane(lane:Vec[],poly:Vec[],halfWidth:number):boolean {
 for(let i=1;i<lane.length;i++){
  const [a,b]=[lane[i-1],lane[i]];
  if(pointInPolygon(a,poly)||pointInPolygon(b,poly))return true;
  if(edges(poly).some(([c,d])=>segmentDistance(a,b,c,d)<halfWidth+2))return true;
 }
 return false;
}

export type GeometryReport={
 ok:boolean;errors:string[];laneLengths:number[];
 shortestPassageSeconds:{ordinary:number;fast:number};
 drySites:string[];wetSites:string[];
};
export function analyzeGeometry(map:MapDef=getMap()):GeometryReport {
 const errors:string[]=[];
 const fail=(s:string)=>{errors.push(s);};
 if(map.id!=='salt-marsh'||map.campaignIndex!==9||map.difficulty!==2||map.theme!=='estuary'||map.recommendedDifficulty!=='normal')fail('Incorrect map metadata');
 if(map.lanes.length!==2||map.water.length!==2)fail('Expected exactly two lanes and two channels');
 if(map.pathWidth<34||map.pathWidth>52)fail('Unplayable path width');
 map.lanes.forEach((lane,i)=>{
  if(lane.length<8||lane.some(p=>!inBounds(p)))fail(`Lane ${i} invalid or out of bounds`);
  for(let k=1;k<lane.length;k++)if(distance(lane[k-1],lane[k])<8)fail(`Lane ${i} degenerate segment ${k}`);
  for(let k=2;k<lane.length;k++)for(let j=1;j<k-1;j++)if(segmentsIntersect(lane[k-1],lane[k],lane[j-1],lane[j]))fail(`Lane ${i} self crossing ${j}/${k}`);
  if(lane[0].x>25||lane.at(-1)!.x<WORLD.width-25)fail(`Lane ${i} invisible entrance or exit`);
  if(laneLength(lane)<1280)fail(`Lane ${i} too short`);
  if(distance(pointOnLane(lane,laneLength(lane)),{x:1270,y:361})>EPS)fail(`Lane ${i} ends away from exit`);
 });
 if(map.lanes.length===2){
  const [a,b]=map.lanes;
  if(a.slice(-3).some((p,i)=>distance(p,b[b.length-3+i])>EPS))fail('Last two segments must share the exit');
  for(let i=1;i<a.length-3;i++)for(let j=1;j<b.length-3;j++)if(segmentsIntersect(a[i-1],a[i],b[j-1],b[j]))fail(`Premature crossing ${i}/${j}`);
 }
 [...map.water,...map.blocked].forEach((poly,i)=>{
  if(poly.length<3||poly.some(p=>!inBounds(p))||area(poly)<300)fail(`Polygon ${i} invalid`);
  if(selfCross(poly))fail(`Polygon ${i} self crossing`);
  if(edges(poly).some(([a,b])=>distance(a,b)<5))fail(`Polygon ${i} degenerate edge`);
 });
 map.blocked.forEach((poly,i)=>map.lanes.forEach((lane,j)=>{
  if(blockedOverlapsLane(lane,poly,map.pathWidth/2))fail(`Blocked polygon ${i} overlaps lane ${j}`);
 }));
 const drySites=Object.entries(SITES).filter(([,p])=>canPlace(map,p,LAND_FOOTPRINT,'land')).map(([id])=>id);
 const wetSites=Object.entries(WATER_SITES).filter(([,p])=>canPlace(map,p,WATER_FOOTPRINT,'water')).map(([id])=>id);
 if(drySites.length!==Object.keys(SITES).length)fail(`Unsafe land sites: ${Object.keys(SITES).filter(id=>!drySites.includes(id)).join(',')}`);
 if(wetSites.length!==2)fail('Both channels need water tower positions');
 for(const [name,sites] of Object.entries(COMPOSITIONS)){
  if(sites.length<3)fail(`Composition ${name} too small`);
  for(let i=0;i<sites.length;i++)for(let j=i+1;j<sites.length;j++)if(distance(SITES[sites[i]],SITES[sites[j]])<2*LAND_FOOTPRINT+MARGIN)fail(`Composition ${name} footprint overlap`);
 }
 const laneLengths=map.lanes.map(laneLength),shortest=Math.min(...laneLengths);
 if(shortest/175<7.5)fail('Insufficient time for fast approaches');
 return {ok:errors.length===0,errors,laneLengths,shortestPassageSeconds:{ordinary:shortest/95,fast:shortest/175},drySites,wetSites};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const result=analyzeGeometry();
 process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
 if(!result.ok)process.exitCode=1;
}
