import {fork,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {createConnection} from 'node:net';
import {expect} from '@playwright/test';
import type {ClientMessage,ServerMessage,GameAction,GameState,MapDef,TowerDef,Vec} from '../../src/contracts';
import {distanceToSegment,pointInPolygon} from '../../src/contracts/geometry';

type Message<K extends ServerMessage['type']>=Extract<ServerMessage,{type:K}>;
export type Ready={type:'ready';port:number;digest:string;map:MapDef;tower:TowerDef};
export async function bounded<T>(p:Promise<T>,ms=8000,label='operation'):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([p,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),ms);})]);}
  finally{clearTimeout(timer);}
}
export async function stopChild(child:ChildProcess):Promise<void>{
  if(child.exitCode!==null||child.signalCode!==null)return;
  const exit=once(child,'exit');
  if(child.connected)child.send('stop');
  else child.kill();
  try{await bounded(exit,5000,'host shutdown');}
  catch{child.kill('SIGKILL');await bounded(exit,5000,'forced host shutdown');throw new Error('Host needed forced shutdown');}
}
export async function launch(count:2|4,short=false){
  const child=fork(resolve('tests/e2e/host-worker.ts'),[String(count),short?'short':'normal'],{
    execArgv:['--import','tsx'],stdio:['ignore','inherit','inherit','ipc']
  });
  try{
    const ready=await bounded(new Promise<Ready>((resolve,reject)=>{
      child.once('error',reject);child.once('exit',(code)=>reject(new Error('Host exited before ready: '+code)));
      child.on('message',m=>{if((m as Ready).type==='ready')resolve(m as Ready);});
    }),15000,'host startup');
    if(!Number.isInteger(ready.port)||ready.port<=0)throw new Error('Host did not bind a real port');
    return {child,ready,url:'ws://127.0.0.1:'+ready.port,stop:()=>stopChild(child)};
  }catch(e){await stopChild(child).catch(()=>{});throw e;}
}
export async function assertPortClosed(port:number){
  await expect.poll(()=>new Promise<boolean>(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port});
    socket.setTimeout(500);
    socket.once('connect',()=>{socket.destroy();resolve(false);});
    socket.once('error',()=>resolve(true));
    socket.once('timeout',()=>{socket.destroy();resolve(false);});
  }),{timeout:5000}).toBe(true);
}
export class Peer {
  readonly frames:ServerMessage[]=[];
  readonly socket:WebSocket;
  private fault:Error|undefined;
  private closed=false;
  seq=0;
  constructor(url:string){
    this.socket=new WebSocket(url);
    this.socket.addEventListener('message',e=>{
      try{
        if(typeof e.data!=='string')throw new Error('Expected text frame');
        if(Buffer.byteLength(e.data)>2*1024*1024)throw new Error('Frame exceeds 2 MiB');
        this.frames.push(JSON.parse(e.data) as ServerMessage);
        if(this.frames.length>5000)throw new Error('Unexpected frame flood');
      }catch(err){this.fault=err as Error;}
    });
    this.socket.addEventListener('close',()=>{this.closed=true;});
  }
  async open(){
    if(this.socket.readyState===WebSocket.OPEN)return;
    await bounded(new Promise<void>((resolve,reject)=>{
      this.socket.addEventListener('open',()=>resolve(),{once:true});
      this.socket.addEventListener('error',()=>reject(new Error('WebSocket open failed')),{once:true});
      this.socket.addEventListener('close',()=>reject(new Error('Socket closed before open')),{once:true});
    }),8000,'socket open');
  }
  send(message:ClientMessage){this.socket.send(JSON.stringify(message));}
  async wait<K extends ServerMessage['type']>(type:K,predicate:(m:Message<K>)=>boolean=()=>true,from=0):Promise<Message<K>>{
    let found:Message<K>|undefined;
    await expect.poll(()=>{
      if(this.fault)throw this.fault;
      found=this.frames.slice(from).find(m=>m.type===type&&predicate(m as Message<K>)) as Message<K>|undefined;
      return !!found;
    },{timeout:12000,intervals:[20,50,100,200]}).toBe(true);
    return found!;
  }
  async join(digest:string,name:string,resumeToken?:string){
    await this.open();
    this.send({type:'join',protocolVersion:1,contentDigest:digest,name,password:'qa-room',...(resumeToken?{resumeToken}:{})});
    return this.wait('welcome');
  }
  async command(command:GameAction){
    const seq=++this.seq,from=this.frames.length;
    this.send({type:'command',seq,command});
    return (await this.wait('result',m=>m.seq===seq,from)).result;
  }
  async close(){
    if(this.socket.readyState!==WebSocket.CLOSED)this.socket.close();
    await this.waitClosed();
  }
  async waitClosed(){await expect.poll(()=>this.closed||this.socket.readyState===WebSocket.CLOSED,{timeout:8000}).toBe(true);}
}
export function positions(map:MapDef,tower:TowerDef):Vec[]{
  const r=tower.footprint+5;
  const polygons=[...map.blocked,...(tower.placement==='land'?map.water:[])];
  const near=(p:Vec,poly:Vec[],d:number)=>pointInPolygon(p,poly)||poly.some((a,i)=>distanceToSegment(p,a,poly[(i+1)%poly.length])<d);
  const result:Vec[]=[];
  for(let y=r+20;y<720-r;y+=Math.max(30,2*r))for(let x=r+20;x<1280-r;x+=Math.max(30,2*r)){
    const p={x,y};
    if(map.lanes.some(l=>l.slice(1).some((b,i)=>distanceToSegment(p,l[i],b)<r+map.pathWidth/2)))continue;
    if(polygons.some(poly=>near(p,poly,r)))continue;
    if(tower.placement==='water'&&!map.water.some(poly=>pointInPolygon(p,poly)&&poly.every((a,i)=>distanceToSegment(p,a,poly[(i+1)%poly.length])>=r)))continue;
    result.push(p);
  }
  return result;
}
export function ledger(state:GameState){
  return {credits:state.credits,lives:state.lives,players:state.options.players.map(p=>({id:p.id,connected:p.connected})).sort((a,b)=>a.id.localeCompare(b.id)),
    towers:state.towers.map(t=>({id:t.id,owner:t.owner,defId:t.defId,tiers:t.tiers,invested:t.invested})).sort((a,b)=>a.id.localeCompare(b.id))};
}
export async function converge(peers:Peer[],predicate:(s:GameState)=>boolean){
  const snapshots=await Promise.all(peers.map(p=>p.wait('snapshot',m=>predicate(m.state))));
  const state=snapshots[0].state;
  for(const s of snapshots)expect(ledger(s.state)).toEqual(ledger(state));
  expect(state.credits).toBeGreaterThanOrEqual(0);
  return state;
}
