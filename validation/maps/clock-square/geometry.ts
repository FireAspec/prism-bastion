import type {MapDef,Vec} from '../../../src/contracts';
import {getMap} from '../../../src/content/maps/clock-square';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';

export interface BuildSite {id:string;pos:Vec;radius:number;terrain:'land'|'water';role:string;}
export const buildSites:readonly BuildSite[]=[{"id":"north-gate","pos":{"x":70,"y":252},"radius":29,"terrain":"land","role":"North spawn"},{"id":"south-gate","pos":{"x":72,"y":476},"radius":29,"terrain":"land","role":"South spawn"},{"id":"west-high","pos":{"x":292,"y":245},"radius":28,"terrain":"land","role":"North western arc"},{"id":"west-low","pos":{"x":289,"y":471},"radius":28,"terrain":"land","role":"South western arc"},{"id":"cross-north","pos":{"x":634,"y":267},"radius":30,"terrain":"land","role":"Time Archive crossing"},{"id":"cross-south","pos":{"x":634,"y":457},"radius":30,"terrain":"land","role":"Lower crossing"},{"id":"east-fork","pos":{"x":766,"y":360},"radius":30,"terrain":"land","role":"Eastern fork"},{"id":"east-high","pos":{"x":887,"y":282},"radius":28,"terrain":"land","role":"North eastern arc"},{"id":"east-low","pos":{"x":893,"y":448},"radius":28,"terrain":"land","role":"South eastern arc"},{"id":"exit-guard","pos":{"x":1146,"y":288},"radius":28,"terrain":"land","role":"Shared exit"},{"id":"upper-coolant","pos":{"x":895,"y":76},"radius":28,"terrain":"water","role":"Upper coolant basin"},{"id":"lower-coolant","pos":{"x":508,"y":660},"radius":24,"terrain":"water","role":"Lower coolant basin"}];
const eps=1e-7;
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const on=(a:Vec,b:Vec,c:Vec)=>Math.abs(cross(a,b,c))<eps&&
 c.x>=Math.min(a.x,b.x)-eps&&c.x<=Math.max(a.x,b.x)+eps&&
 c.y>=Math.min(a.y,b.y)-eps&&c.y<=Math.max(a.y,b.y)+eps;
export function segmentsIntersect(a:Vec,b:Vec,c:Vec,d:Vec):boolean{
 const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
 return (((x>eps&&y< -eps)||(x< -eps&&y>eps))&&
   ((u>eps&&v< -eps)||(u< -eps&&v>eps)))||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
const edges=(poly:Vec[])=>poly.map((p,i)=>[p,poly[(i+1)%poly.length]] as const);
export function segmentDistance(a:Vec,b:Vec,c:Vec,d:Vec):number{
 if(segmentsIntersect(a,b,c,d))return 0;
 return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
export function pointPolygonClearance(p:Vec,poly:Vec[]):number{
 return Math.min(...edges(poly).map(([a,b])=>distanceToSegment(p,a,b)));
}
export function lanePolygonClearance(lane:Vec[],poly:Vec[]):number{
 return Math.min(...lane.slice(1).map((p,i)=>{
  const a=lane[i];
  if(pointInPolygon(a,poly)||pointInPolygon(p,poly))return 0;
  return Math.min(...edges(poly).map(([c,d])=>segmentDistance(a,p,c,d)));
 }));
}
export function siteClearance(site:BuildSite,map:MapDef):number {
 const path=Math.min(...map.lanes.map(lane=>Math.min(...lane.slice(1).map((p,i)=>distanceToSegment(site.pos,lane[i],p)))-map.pathWidth/2));
 const buildings=Math.min(...map.blocked.map(poly=>pointInPolygon(site.pos,poly)?-pointPolygonClearance(site.pos,poly):pointPolygonClearance(site.pos,poly)));
 const edge=Math.min(site.pos.x,1280-site.pos.x,site.pos.y,720-site.pos.y);
 const water=site.terrain==='land'?
  Math.min(...map.water.map(poly=>pointInPolygon(site.pos,poly)?-pointPolygonClearance(site.pos,poly):pointPolygonClearance(site.pos,poly))):
  Math.max(0,...map.water.filter(poly=>pointInPolygon(site.pos,poly)).map(poly=>pointPolygonClearance(site.pos,poly)));
 return Math.min(path,buildings,edge,water);
}
export interface GeometryReport {
 valid:boolean;errors:string[];lengths:number[];traversalSecondsAt100:number[];
 traversalSecondsAt200:number[];minimumRoadToPolygonClearance:number;
 sites:{id:string;radius:number;clearance:number;valid:boolean}[];
}
export function analyzeMap(map:MapDef=getMap()):GeometryReport {
 const errors:string[]=[];
 const within=(p:Vec)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1280&&p.y>=0&&p.y<=720;
 if(map.id!=='clock-square'||map.campaignIndex!==11||map.difficulty!==3||
    map.recommendedDifficulty!=='hard'||map.theme!=='foundry')errors.push('Wrong map identity');
 if(map.lanes.length!==2)errors.push('Expected exactly two permanent lanes');
 if(!(map.pathWidth>=38&&map.pathWidth<=55))errors.push('Invalid path width');
 map.lanes.forEach((lane,i)=>{
  if(lane.length<2)errors.push('Lane '+i+' has too few points');
  lane.forEach((p,j)=>{
   if(!within(p))errors.push('Lane '+i+' point '+j+' is outside the world');
   if(j&&distance(lane[j-1],p)<eps)errors.push('Lane '+i+' segment '+j+' is zero length');
  });
  if(lane[0]?.x!==0||lane.at(-1)?.x!==1280)errors.push('Lane '+i+' has hidden entrance/exit');
  if(laneLength(lane)<1400)errors.push('Lane '+i+' is too short for reasonable response');
 });
 if(map.lanes.length===2){
  if(distance(map.lanes[0][0],map.lanes[1][0])<200)errors.push('Entrances are too close');
  if(distance(map.lanes[0].at(-1)!,map.lanes[1].at(-1)!)>eps)errors.push('No shared exit');
  if(!map.lanes.every(l=>l.some(p=>distance(p,{x:654,y:361})<eps)))errors.push('No shared crossing');
  if(!map.lanes.every(l=>distance(l.at(-2)!,{x:1100,y:360})<eps))errors.push('No final shared approach');
 }
 const polys=[...map.blocked.map((p,i)=>({p,name:'blocked '+i})),...map.water.map((p,i)=>({p,name:'water '+i}))];
 for(const {p,name} of polys){
  if(p.length<3||p.some(v=>!within(v)))errors.push(name+' is outside the world');
  if(edges(p).some(([a,b])=>distance(a,b)<eps))errors.push(name+' has zero length edge');
  const area=p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-a.y*b.x},0)/2;
  if(Math.abs(area)<100)errors.push(name+' has too little area');
  edges(p).forEach(([a,b],i)=>edges(p).forEach(([c,d],j)=>{
   if(j>i+1&&!(i===0&&j===p.length-1)&&segmentsIntersect(a,b,c,d))errors.push(name+' self-intersects');
  }));
 }
 const gaps=map.lanes.flatMap((lane,i)=>polys.map(({p,name})=>{
  const gap=lanePolygonClearance(lane,p)-map.pathWidth/2;
  if(gap< -eps)errors.push('Lane '+i+' hits '+name);
  return gap;
 }));
 const siteReport=buildSites.map(site=>{
  const clearance=siteClearance(site,map),valid=clearance+eps>=site.radius;
  if(!valid)errors.push('Build site '+site.id+' overlaps an obstacle or road');
  return {id:site.id,radius:site.radius,clearance,valid};
 });
 const lengths=map.lanes.map(laneLength);
 return {valid:errors.length===0,errors,lengths,traversalSecondsAt100:lengths.map(v=>v/100),
  traversalSecondsAt200:lengths.map(v=>v/200),minimumRoadToPolygonClearance:Math.min(...gaps),sites:siteReport};
}
