import type {Vec} from './index';
export function distance(a:Vec,b:Vec):number{return Math.hypot(a.x-b.x,a.y-b.y);}
export function laneLength(lane:Vec[]):number{return lane.slice(1).reduce((n,p,i)=>n+distance(lane[i],p),0);}
export function pointOnLane(lane:Vec[],progress:number):Vec {
 if(lane.length<2)throw new Error('A lane needs two points');
 let left=Math.max(0,progress);
 for(let i=1;i<lane.length;i++){
  const a=lane[i-1],b=lane[i],len=distance(a,b);
  if(left<=len&&len>0){const t=left/len;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
  left-=len;
 }
 return {...lane[lane.length-1]};
}
export function distanceToSegment(p:Vec,a:Vec,b:Vec):number {
 const d=(b.x-a.x)**2+(b.y-a.y)**2;
 const t=d===0?0:Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/d));
 return distance(p,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
}
export function pointInPolygon(p:Vec,polygon:Vec[]):boolean {
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
 }
 return inside;
}
