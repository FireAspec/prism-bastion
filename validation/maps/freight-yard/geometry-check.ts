import {fileURLToPath} from 'node:url';
import {getMap} from '../../../src/content/maps/freight-yard';
import {distance,distanceToSegment,laneLength,pointInPolygon} from '../../../src/contracts/geometry';
import type {Vec} from '../../../src/contracts';

export const TOWER_RADIUS=28;
export const BUFFER=8;
export const spots=[
 {id:'west-gate',x:166,y:273,role:'entrance A'},
 {id:'west-backup',x:273,y:330,role:'western flex'},
 {id:'west-relay',x:344,y:321,role:'western crossfire'},
 {id:'north-gantry',x:581,y:82,role:'north range'},
 {id:'north-yard',x:451,y:307,role:'north utility'},
 {id:'central-west',x:599,y:330,role:'central crossfire'},
 {id:'central-east',x:699,y:331,role:'central crossfire'},
 {id:'signal-tower',x:792,y:326,role:'dual lane support'},
 {id:'east-interlock',x:883,y:322,role:'merge approach'},
 {id:'south-switch',x:436,y:506,role:'south control'},
 {id:'south-yard',x:642,y:638,role:'south backfield'},
 {id:'south-watch',x:737,y:680,role:'south entrance'},
 {id:'exit-watch',x:1115,y:476,role:'exit cover'},
] as const;

type Check={id:string;ok:boolean;detail:string};
const p=(v:{x:number;y:number}):Vec=>({x:v.x,y:v.y});
const cross=(a:Vec,b:Vec,c:Vec)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersects=(a:Vec,b:Vec,c:Vec,d:Vec)=>{
 const e=1e-7,ca=cross(a,b,c),da=cross(a,b,d),ac=cross(c,d,a),bc=cross(c,d,b);
 if((ca>e&&da< -e||ca< -e&&da>e)&&(ac>e&&bc< -e||ac< -e&&bc>e))return true;
 return Math.abs(ca)<=e&&distanceToSegment(c,a,b)<=e||Math.abs(da)<=e&&distanceToSegment(d,a,b)<=e||
  Math.abs(ac)<=e&&distanceToSegment(a,c,d)<=e||Math.abs(bc)<=e&&distanceToSegment(b,c,d)<=e;
};
const segDistance=(a:Vec,b:Vec,c:Vec,d:Vec)=>intersects(a,b,c,d)?0:
 Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
const edges=(poly:Vec[]):[Vec,Vec][]=>(poly.map((v,i)=>[v,poly[(i+1)%poly.length]]));
const pointPolygonGap=(v:Vec,poly:Vec[])=>pointInPolygon(v,poly)?0:
 Math.min(...edges(poly).map(([a,b])=>distanceToSegment(v,a,b)));
const laneGap=(v:Vec,lane:Vec[])=>Math.min(...lane.slice(1).map((b,i)=>distanceToSegment(v,lane[i],b)));
export function isLandClear(v:Vec,radius=TOWER_RADIUS){
 const m=getMap();
 return v.x>=radius+BUFFER&&v.y>=radius+BUFFER&&v.x<=1280-radius-BUFFER&&v.y<=720-radius-BUFFER&&
  m.lanes.every(l=>laneGap(v,l)>=m.pathWidth/2+radius+BUFFER)&&
  [...m.blocked,...m.water].every(poly=>pointPolygonGap(v,poly)>=radius+BUFFER);
}
export function analyzeFreightYard(){
 const m=getMap(),polys=[...m.blocked,...m.water],checks:Check[]=[];
 const add=(id:string,ok:boolean,detail:string)=>checks.push({id,ok,detail});
 add('identity',m.id==='freight-yard'&&m.campaignIndex===6&&m.difficulty===2&&m.recommendedDifficulty==='normal'&&m.theme==='foundry','Frozen map ID, group and selected difficulty');
 add('bounds',m.lanes.every(l=>l.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.x<=1280&&v.y>=0&&v.y<=720))&&
  polys.every(q=>q.length>=3&&q.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.x<=1280&&v.y>=0&&v.y<=720)),
  'World bounds 1280×720');
 add('entrances',m.lanes.length===2&&m.lanes[0][0].x===0&&m.lanes[1][0].y===720&&m.lanes.every(l=>l.at(-1)?.x===1280&&l.at(-1)?.y===380),
  'West / south entries and east exit');
 add('merge',m.lanes[0].slice(-3).map(v=>`${v.x}:${v.y}`).join(',')===m.lanes[1].slice(-3).map(v=>`${v.x}:${v.y}`).join(',')&&
  m.lanes[0].at(-3)?.x===1070,'Shared 210px terminal segment');
 for(const [i,lane] of m.lanes.entries()){
  add(`segments-${i}`,lane.length>=2&&lane.slice(1).every((v,j)=>distance(lane[j],v)>0),'No zero-length segments');
  // Inward folds must never overlap their own corridor outside a shared corner.
  for(let a=0;a<lane.length-1;a++)for(let b=a+2;b<lane.length-1;b++){
   const gap=segDistance(lane[a],lane[a+1],lane[b],lane[b+1]);
   if(gap<m.pathWidth)add(`lane-${i}-fold-${a}-${b}`,false,`Self-distance ${gap.toFixed(1)} < ${m.pathWidth}`);
  }
  for(const [j,poly] of polys.entries()){
   let min=Infinity;
   for(let t=1;t<lane.length;t++){
    if(pointInPolygon(lane[t-1],poly)||pointInPolygon(lane[t],poly))min=0;
    for(const [a,b] of edges(poly))min=Math.min(min,segDistance(lane[t-1],lane[t],a,b));
   }
   add(`lane-${i}-poly-${j}`,min>=m.pathWidth/2+3,`Distance ${min.toFixed(1)}px to polygon, 29px required`);
  }
 }
 for(const [i,poly] of polys.entries()){
  const area=Math.abs(poly.reduce((sum,v,j)=>sum+v.x*poly[(j+1)%poly.length].y-poly[(j+1)%poly.length].x*v.y,0)/2);
  const simple=edges(poly).every(([a,b],j)=>distance(a,b)>10&&edges(poly).every(([c,d],k)=>Math.abs(j-k)<=1||Math.abs(j-k)===poly.length-1||!intersects(a,b,c,d)));
  add(`polygon-${i}`,area>=2500&&simple,`Simple solid area ${area.toFixed(0)}px²`);
 }
 for(const s of spots)add(`spot-${s.id}`,isLandClear(p(s)),`${s.role} (${s.x},${s.y}), radius 28 plus 8px clearance`);
 const simultaneous=['west-gate','west-relay','central-west','central-east','signal-tower','east-interlock','south-switch','south-watch','exit-watch'];
 const chosen=spots.filter(s=>(simultaneous as string[]).includes(s.id));
 add('simultaneous',chosen.every((a,i)=>chosen.slice(i+1).every(b=>distance(p(a),p(b))>=2*TOWER_RADIUS+BUFFER)),
  'Nine concurrent footprints do not overlap');
 add('dual-center',laneGap({x:650,y:330},m.lanes[0])<160&&laneGap({x:650,y:330},m.lanes[1])<160&&
  isLandClear({x:599,y:330})&&isLandClear({x:699,y:331}),'Dual-lane range from central platform');
 for(const [i,v] of [{x:90,y:595},{x:165,y:623},{x:1124,y:609},{x:1196,y:638}].entries()){
  const poly=m.water[i<2?0:1];
  add(`water-${i}`,pointInPolygon(v,poly)&&Math.min(...edges(poly).map(([a,b])=>distanceToSegment(v,a,b)))>=36,
   'Water-only footprint 28px radius +8px room');
 }
 const timing=m.lanes.map((lane,i)=>({lane:i,lengthPx:Math.round(laneLength(lane)),secondsAtFastest132:Number((laneLength(lane)/132).toFixed(1)),secondsAtBoss18:Number((laneLength(lane)/18).toFixed(1))}));
 add('reaction',timing.every(t=>t.secondsAtFastest132>10),'All paths give >10s even at 132px/s baseline');
 add('waves',Object.keys(m.waveOverrides).length===9&&m.waveOverrides[1].groups?.[0].lane===0&&m.waveOverrides[2].groups?.[0].lane===1&&
  Object.entries(m.waveOverrides).every(([n,o])=>Number(n)>=1&&Number(n)<=9&&!o.boss&&o.reward===undefined&&o.groups?.every(g=>g.lane<2&&g.at>=0&&g.every>0)),
  'Alternating first nine waves; no duplicate boss or reward');
 return {status:checks.every(c=>c.ok)?'pass':'fail',mapId:m.id,pathWidth:m.pathWidth,timing,spots,checks};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const report=analyzeFreightYard();
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 if(report.status!=='pass')process.exitCode=1;
}
