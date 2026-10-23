import type {MapDef,Vec} from '../../../src/contracts';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';
import {getMap} from '../../../src/content/maps/glass-switchback';

const EPS=1e-7;
export type Surface='land'|'water';
export interface Site {id:string;pos:Vec;radius:number;surface:Surface;purpose:string}

/** Fixed test points also serve as the named placements in the tactical guide. */
export const sites:Site[]=[
 {id:'north-guard',pos:{x:640,y:184},radius:26,surface:'land',purpose:'main opening crossfire'},
 {id:'west-hairpin',pos:{x:483,y:295},radius:25,surface:'land',purpose:'second bend coverage'},
 {id:'center-overlook',pos:{x:711,y:292},radius:26,surface:'land',purpose:'third bend / reveal'},
 {id:'lower-overlook',pos:{x:700,y:509},radius:26,surface:'land',purpose:'last descent'},
 {id:'east-hairpin',pos:{x:931,y:316},radius:25,surface:'land',purpose:'far east switchback'},
 {id:'exit-guard',pos:{x:1077,y:620},radius:26,surface:'land',purpose:'final safety net'},
 {id:'economy-shelf',pos:{x:190,y:247},radius:26,surface:'land',purpose:'income away from road'},
 {id:'north-pool',pos:{x:1104,y:183},radius:24,surface:'water',purpose:'north pool'},
 {id:'west-pool',pos:{x:144,y:432},radius:24,surface:'water',purpose:'west pool'},
 {id:'lower-pool',pos:{x:736,y:662},radius:24,surface:'water',purpose:'south pool'},
];

function cross(a:Vec,b:Vec,c:Vec):number {return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function onSegment(p:Vec,a:Vec,b:Vec):boolean {return Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
export function intersect(a:Vec,b:Vec,c:Vec,d:Vec):boolean {
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 if((x>EPS&&y< -EPS||x< -EPS&&y>EPS)&&(z>EPS&&w< -EPS||z< -EPS&&w>EPS))return true;
 return onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
export function segmentDistance(a:Vec,b:Vec,c:Vec,d:Vec):number {
 return intersect(a,b,c,d)?0:Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
export function edgeClearance(p:Vec,polygon:Vec[]):number {
 return Math.min(...polygon.map((a,i)=>distanceToSegment(p,a,polygon[(i+1)%polygon.length])));
}
export function polygonArea(p:Vec[]):number {return Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-a.y*b.x;},0)/2);}
export function polygonsTouch(a:Vec[],b:Vec[]):boolean {
 if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return true;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(intersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
 return false;
}
export function roadClearance(pos:Vec,map:MapDef=getMap()):number {
 return Math.min(...map.lanes.flatMap(lane=>lane.slice(1).map((p,i)=>distanceToSegment(pos,lane[i],p))))-map.pathWidth/2;
}
export function legalSite(pos:Vec,radius:number,surface:Surface,map:MapDef=getMap()):boolean {
 if(!(Number.isFinite(pos.x)&&Number.isFinite(pos.y)&&Number.isFinite(radius))||radius<=0)return false;
 if(pos.x-radius<0||pos.x+radius>1280||pos.y-radius<0||pos.y+radius>720)return false;
 if(roadClearance(pos,map)<radius+2-EPS)return false;
 if(surface==='water')return map.water.some(p=>pointInPolygon(pos,p)&&edgeClearance(pos,p)>=radius+2-EPS);
 if(map.water.some(p=>pointInPolygon(pos,p)||edgeClearance(pos,p)<radius+2-EPS))return false;
 if(map.blocked.some(p=>pointInPolygon(pos,p)||edgeClearance(pos,p)<radius+2-EPS))return false;
 return true;
}
export function validatePolygon(poly:Vec[],name:string):string[] {
 const problems:string[]=[];
 if(poly.length<3||polygonArea(poly)<1)problems.push(`${name}: degenerate polygon`);
 for(const p of poly)if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1280||p.y<0||p.y>720)problems.push(`${name}: out-of-bounds or non-finite vertex`);
 for(let i=0;i<poly.length;i++)for(let j=i+1;j<poly.length;j++){
  if(j===i+1||(i===0&&j===poly.length-1))continue;
  if(intersect(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))problems.push(`${name}: self-crosses (${i},${j})`);
 }
 return problems;
}
export function analyzeMap(map:MapDef=getMap()) {
 const errors:string[]=[];
 if(map.lanes.length!==1)errors.push('Expected one serpentine lane');
 if(map.pathWidth!==38)errors.push('Unexpected road width');
 for(const [li,lane] of map.lanes.entries()){
  if(lane.length<2)errors.push(`lane ${li}: too short`);
  for(const p of lane)if(p.x<0||p.x>1280||p.y<0||p.y>720)errors.push(`lane ${li}: out of world`);
  for(let i=1;i<lane.length;i++)if(distance(lane[i-1],lane[i])<1)errors.push(`lane ${li}: degenerate segment ${i}`);
  // Two segments on either side of one short turn belong to the same swept road.
  for(let i=1;i<lane.length;i++)for(let j=i+3;j<lane.length;j++){
   if(i===1&&j===lane.length-1)continue;
   if(segmentDistance(lane[i-1],lane[i],lane[j-1],lane[j])<map.pathWidth+5)errors.push(`lane ${li}: nonadjacent segments ${i}/${j} collide`);
  }
 }
 const polygons=[...map.water.map((p,i)=>({p,name:`water ${i}`})),...map.blocked.map((p,i)=>({p,name:`blocked ${i}`}))];
 for(const {p,name} of polygons)errors.push(...validatePolygon(p,name));
 for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++)if(polygonsTouch(polygons[i].p,polygons[j].p))errors.push(`${polygons[i].name} meets ${polygons[j].name}`);
 for(const {p,name} of polygons)for(const lane of map.lanes)for(let j=1;j<lane.length;j++){
  const a=lane[j-1],b=lane[j];
  if(pointInPolygon(a,p)||pointInPolygon(b,p))errors.push(`${name} covers road centerline`);
  for(let i=0;i<p.length;i++)if(segmentDistance(a,b,p[i],p[(i+1)%p.length])<map.pathWidth/2+2-EPS)errors.push(`${name} reaches road edges`);
 }
 for(const site of sites)if(!legalSite(site.pos,site.radius,site.surface,map))errors.push(`invalid named placement ${site.id}`);
 for(let i=0;i<sites.length;i++)for(let j=i+1;j<sites.length;j++)if(distance(sites[i].pos,sites[j].pos)<sites[i].radius+sites[j].radius+4)errors.push(`overlap ${sites[i].id} / ${sites[j].id}`);
 const l=map.lanes[0];
 const horizontal=l.slice(1).map((p,i)=>Math.sign(p.x-l[i].x)).filter(Boolean);
 const horizontalReversals=horizontal.slice(1).filter((dir,i)=>dir!==horizontal[i]).length;
 const longestStraight=Math.max(...l.slice(1).map((p,i)=>distance(p,l[i])));
 let minSeparated=Infinity;
 for(let i=1;i<l.length;i++)for(let j=i+3;j<l.length;j++)minSeparated=Math.min(minSeparated,segmentDistance(l[i-1],l[i],l[j-1],l[j]));
 let buildableLand26=0,buildableWater24=0;
 for(let y=24;y<720;y+=24)for(let x=24;x<1280;x+=24){if(legalSite({x,y},26,'land',map))buildableLand26++;if(legalSite({x,y},24,'water',map))buildableWater24++;}
 return {mapId:map.id,errors,pathLength:laneLength(l),horizontalReversals,longestStraight,minSeparated,buildableLand26,buildableWater24,sites:sites.length};
}
