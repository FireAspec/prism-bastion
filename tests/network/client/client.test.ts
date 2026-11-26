import {test,expect} from 'vitest';
import {createCoopClient} from '../../../src/network/client';
import type {ClientMessage,ServerMessage,GameState,RoomState,RunOptions,RuleModifiers} from '../../../src/contracts';

class Clock {
  now=0; next=0; jobs=new Map<number,{at:number;fn:()=>void}>();
  schedule=(fn:()=>void,ms:number)=>{const id=++this.next;this.jobs.set(id,{at:this.now+ms,fn});return id as unknown as ReturnType<typeof setTimeout>;};
  cancel=(id:ReturnType<typeof setTimeout>)=>{this.jobs.delete(id as unknown as number);};
  advance(ms:number){const end=this.now+ms;while(true){const next=[...this.jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;this.now=next[1].at;this.jobs.delete(next[0]);next[1].fn();}this.now=end;}
}
class Socket {
  readyState=0;bufferedAmount=0;out:ClientMessage[]=[];
  onopen:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;
  onerror:(()=>void)|null=null;onclose:((e:{code:number})=>void)|null=null;
  open(){this.readyState=1;this.onopen?.();}
  send(raw:string){this.out.push(JSON.parse(raw));}
  message(m:ServerMessage){this.onmessage?.({data:JSON.stringify(m)});}
  close(){this.readyState=3;}
  drop(){this.readyState=3;this.onclose?.({code:1006});}
}
const options:RunOptions={mapId:'lantern-garden',difficulty:'normal',seed:2,endless:false,modeId:'standard',unlockedTowers:['needle'],players:[{id:'p1',name:'Guest',color:'blue',connected:true}],runId:'run-1',knowledge:[]};
const room:RoomState={id:'room-1',name:'Room',hostId:'host',players:options.players,ready:[],started:true,options,protocolVersion:1,contentDigest:'digest'};
const hello:Extract<ClientMessage,{type:'join'}>={type:'join',protocolVersion:1,contentDigest:'digest',name:'Guest',password:''};
const rules:RuleModifiers={incomeMul:1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1,sellAllowed:true,maxLives:150,allowAbilities:true,allowPassiveIncome:true,maxTowers:60,maxTier:5,weather:'none',allowKnowledge:true,rounds:60,roundRewardBase:80,roundRewardStep:4,popCashMul:1};
function state(tick:number,credits:number,x=0):GameState{return {version:1,options,phase:'wave',time:tick/60,rules,tick,rng:1,nextEntity:2,nextEvent:1,credits,lives:150,wave:1,waveTime:tick/60,spawnCursor:[],paused:false,speed:1,autoStart:false,towers:[],enemies:[{id:'e1',defId:'scarlet',lane:0,progress:x,pos:{x,y:0},hp:12,maxHp:12,shield:0,maxShield:0,statuses:[],memory:{},bountyPaid:false,generation:0,paidLayers:[]}],events:[],projectiles:[],strikes:[],stats:{spent:0,earned:0,kills:0,damage:0,leaks:0,abilities:0,cashSubunits:0}};}
function setup(){const clock=new Clock(),sockets:Socket[]=[];const client=createCoopClient({socket:()=>{const s=new Socket();sockets.push(s);return s as unknown as WebSocket;},now:()=>clock.now,random:()=>0.5,schedule:clock.schedule,cancel:clock.cancel,encode:JSON.stringify,parseClient:raw=>JSON.parse(raw),parseServer:raw=>JSON.parse(raw)});return {clock,sockets,client};}
function welcome(s:Socket,token='resume-1'){s.message({type:'welcome',playerId:'p1',resumeToken:token,room});}
async function connected(){const env=setup();const p=env.client.connect('ws://localhost:43127',hello);const s=env.sockets[0];s.open();welcome(s);await p;return {...env,s};}
function snapshot(s:Socket,seq:number,tick:number,credits:number,x=0){s.message({type:'snapshot',seq,state:state(tick,credits,x),events:[]});}
const action={type:'place',tower:'needle',pos:{x:20,y:40}} as const;

test('waits for welcome, four listeners share one socket and ping',async()=>{
  const {client,clock,sockets}=setup();let count=0;for(let i=0;i<4;i++)client.subscribe(()=>count++);
  const p=client.connect('ws://localhost:43127',hello);const s=sockets[0];s.open();expect(s.out).toEqual([hello]);
  expect(client.status().phase).toBe('connecting');welcome(s);await p;expect(count).toBe(4);expect(sockets.length).toBe(1);
  const ping=s.out.find(m=>m.type==='ping');expect(ping).toBeDefined();clock.advance(40);if(ping?.type==='ping')s.message({type:'pong',at:ping.at});expect(client.status().latencyMs).toBe(40);client.close();expect(clock.jobs.size).toBe(0);
});
test('late and duplicate snapshots do not roll back credits; renderer interpolates only positions',async()=>{
  const {client,clock,s}=await connected();let n=0;client.subscribe(m=>{if(m.type==='snapshot')n++;});snapshot(s,1,10,900,0);clock.advance(100);snapshot(s,2,16,650,100);snapshot(s,1,10,900);snapshot(s,2,16,900);snapshot(s,3,9,900);
  expect(n).toBe(2);expect(client.getSnapshot()?.credits).toBe(650);expect(client.sample(175)?.enemies[0].pos.x).toBe(50);expect(client.sample(175)?.credits).toBe(650);
  const copy=client.getSnapshot();if(copy)copy.credits=0;expect(client.getSnapshot()?.credits).toBe(650);client.close();
});
test('pending command is not applied locally; original sequence replay and one result',async()=>{
  const {client,clock,s,sockets}=await connected();snapshot(s,1,1,900);const results:ServerMessage[]=[];client.subscribe(m=>{if(m.type==='result')results.push(m);});
  expect(client.command(action)).toEqual({ok:false,pending:true,requestId:'1'});expect(client.getSnapshot()?.credits).toBe(900);const sent=s.out.find(m=>m.type==='command');expect(sent).toBeDefined();s.drop();expect(client.status().phase).toBe('reconnecting');expect(client.getSnapshot()?.credits).toBe(900);expect(client.command(action).ok).toBe(false);
  clock.advance(250);const resumed=sockets[1];resumed.open();expect(resumed.out[0]).toEqual({...hello,resumeToken:'resume-1'});welcome(resumed,'resume-2');expect(resumed.out.find(m=>m.type==='command')).toEqual(sent);
  resumed.message({type:'result',seq:1,result:{ok:true,amount:250}});resumed.message({type:'result',seq:1,result:{ok:true,amount:250}});expect(results.length).toBe(1);expect(client.getSnapshot()?.credits).toBe(900);snapshot(resumed,2,2,650);expect(client.getSnapshot()?.credits).toBe(650);client.close();
});
test('handshake timeout rejects and clears timers',async()=>{const {client,clock,sockets}=setup();const p=client.connect('ws://localhost:43127',hello);const rejected=expect(p).rejects.toMatchObject({code:'HANDSHAKE_TIMEOUT'});sockets[0].open();clock.advance(8000);await rejected;expect(client.status().phase).toBe('failed');expect(clock.jobs.size).toBe(0);});
test('server version rejection preserves exact error code',async()=>{const {client,sockets}=setup();const p=client.connect('ws://localhost:43127',hello);const rejected=expect(p).rejects.toMatchObject({code:'VERSION_MISMATCH'});sockets[0].open();sockets[0].message({type:'error',code:'VERSION_MISMATCH',message:'Unsupported version'});await rejected;expect(client.status().code).toBe('VERSION_MISMATCH');});
test('close cancels scheduled reconnect and ignores old callbacks',async()=>{const {client,clock,s,sockets}=await connected();const stale=s.onmessage;s.drop();client.close();clock.advance(120000);stale?.({data:JSON.stringify({type:'welcome',playerId:'p1',resumeToken:'old',room})});expect(sockets.length).toBe(1);expect(clock.jobs.size).toBe(0);expect(client.status().phase).toBe('closed');});
test('rate limit and duplicate command sequence',async()=>{const {client,s,clock}=await connected();for(let i=1;i<=30;i++)client.send({type:'command',seq:i,command:action});expect(()=>client.send({type:'command',seq:31,command:action})).toThrow();expect(s.out.filter(m=>m.type==='command').length).toBe(30);clock.advance(1000);expect(()=>client.send({type:'command',seq:30,command:action})).toThrow();client.send({type:'command',seq:31,command:action});expect(s.out.filter(m=>m.type==='command').length).toBe(31);client.close();});
test('heartbeat timeout starts reconnect without clearing authoritative state',async()=>{const {client,clock,s}=await connected();snapshot(s,1,1,900);clock.advance(12000);expect(client.status().phase).toBe('reconnecting');expect(client.getSnapshot()?.credits).toBe(900);client.close();});
test('resume refuses a different player slot',async()=>{const {client,clock,s,sockets}=await connected();s.drop();clock.advance(250);sockets[1].open();sockets[1].message({type:'welcome',playerId:'p2',resumeToken:'other',room});expect(client.status().code).toBe('SESSION_MISMATCH');expect(clock.jobs.size).toBe(0);});
test('listener unsubscribe and exceptions are isolated',async()=>{const {client,s}=await connected();let called=0;client.subscribe(()=>{throw Error('listener');});const unsubscribe=client.subscribe(()=>called++);snapshot(s,1,1,900);unsubscribe();snapshot(s,2,2,900);expect(called).toBe(1);client.close();});
test('UI command removes actor and requestId from the wire',async()=>{const {client,s}=await connected();client.command({...action,actor:'forged',requestId:'local'});expect(s.out.find(m=>m.type==='command')).toEqual({type:'command',seq:1,command:action});client.close();});
test('oversized outgoing and incoming frames fail without transmission',async()=>{const {client,s}=await connected();expect(()=>client.send({type:'command',seq:1,command:{...action,tower:'x'.repeat(17000)}})).toThrow();expect(s.out.filter(m=>m.type==='command').length).toBe(0);s.onmessage?.({data:'x'.repeat(2*1024*1024+1)});expect(client.status().code).toBe('INVALID_FRAME');});
test('reconnect deadline expires and never creates a solo run',async()=>{const {client,s,clock}=await connected();snapshot(s,1,1,900);s.drop();clock.advance(120000);expect(client.status().code).toBe('RESUME_TIMEOUT');expect(client.getSnapshot()?.credits).toBe(900);expect(clock.jobs.size).toBe(0);});
