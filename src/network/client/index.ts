import { PROTOCOL_VERSION } from '../../contracts';
import type { ClientMessage, ServerMessage, CoopClient, GameAction, GameCommand, GameState, CommandResult } from '../../contracts';
import { encode, parseClient, parseServer } from '../protocol';
import { SnapshotBuffer } from './interpolation';

export type ConnectionPhase = 'idle'|'connecting'|'connected'|'reconnecting'|'failed'|'closed';
export interface ConnectionStatus { phase: ConnectionPhase; latencyMs: number|null; playerId: string|null; code?:string; message?:string }
type Hello = Extract<ClientMessage,{type:'join'}>;
type Outgoing = Exclude<ClientMessage,Hello>;
type Command = Extract<Outgoing,{type:'command'}>;
type Timer = ReturnType<typeof setTimeout>;
export interface ClientDependencies {
  socket(url:string): WebSocket;
  now():number;
  random():number;
  schedule(callback:()=>void,ms:number):Timer;
  cancel(timer:Timer):void;
  encode(message:ClientMessage):string;
  parseClient(raw:string):ClientMessage;
  parseServer(raw:string):ServerMessage;
}
export interface BrowserCoopClient extends CoopClient {
  status():ConnectionStatus;
  subscribeStatus(listener:(status:ConnectionStatus)=>void):()=>void;
  getSnapshot():GameState|null;
  sample(now?:number):GameState|null;
  command(action:GameCommand):CommandResult;
}
export class CoopClientError extends Error {
  constructor(readonly code:string,message:string) { super(message); this.name='CoopClientError'; }
}
const defaults:ClientDependencies = {
  socket:url=>new WebSocket(url), now:()=>performance.now(), random:()=>Math.random(),
  schedule:(fn,ms)=>setTimeout(fn,ms), cancel:t=>clearTimeout(t), encode, parseClient, parseServer,
};
const FRAME_LIMIT=2*1024*1024, COMMAND_LIMIT=16*1024, HANDSHAKE_MS=8000, RESUME_MS=120000;
const PING_MS=3000, PONG_TIMEOUT=12000, RESULT_TIMEOUT=15000, MAX_PENDING=128;
const bytes=(s:string)=>new TextEncoder().encode(s).byteLength;
const failure=(code:string,message:string)=>new CoopClientError(code,message);

export function createCoopClient(overrides:Partial<ClientDependencies> = {}):BrowserCoopClient {
  const d={...defaults,...overrides};
  const buffer=new SnapshotBuffer();
  const listeners=new Set<(message:ServerMessage)=>void>();
  const statuses=new Set<(status:ConnectionStatus)=>void>();
  const pending=new Map<number,{raw:string; sent:number; epoch:number}>();
  const commandTimes:number[]=[];
  const runResults=new Set<string>();
  let status:ConnectionStatus={phase:'idle',latencyMs:null,playerId:null};
  let ws:WebSocket|null=null, epoch=0, url='', hello:Hello|null=null, token:string|undefined;
  let roomId:string|null=null, runId:string|null=null, lastSeq=0, retry=0, deadline=0;
  let timeout:Timer|undefined, service:Timer|undefined, reconnect:Timer|undefined;
  let first:{resolve:()=>void;reject:(e:Error)=>void}|null=null;
  let pingAt:number|null=null, pingSent=0, lastPong=0, nextPing=0;
  const active=()=>status.phase==='connected' && ws?.readyState===1;
  const notify=<T>(set:Set<(x:T)=>void>,value:T):void=>{
    for(const listener of [...set]) if(set.has(listener)) {
      try { listener(structuredClone(value)); } catch { /* A subscriber cannot break the transport. */ }
    }
  };
  const publish=(message:ServerMessage)=>notify(listeners,message);
  function setStatus(phase:ConnectionPhase,code?:string,message?:string):void {
    status={phase,playerId:status.playerId,latencyMs:phase==='connected'?status.latencyMs:null,...(code?{code,message}:{})};
    notify(statuses,status);
  }
  function clearTimers():void {
    for(const t of [timeout,service,reconnect]) if(t!==undefined) d.cancel(t);
    timeout=service=reconnect=undefined;
  }
  function detach():void {
    ++epoch; clearTimers(); pingAt=null;
    const old=ws; ws=null;
    if(old) { old.onopen=old.onmessage=old.onerror=old.onclose=null; try {old.close();} catch { /* already closed */ } }
  }
  function finishError(code:string,message:string):void {
    detach(); hello=null; token=undefined; const waiter=first; first=null; waiter?.reject(failure(code,message));
    setStatus('failed',code,message);
  }
  function lose(code:string,message:string):void {
    detach();
    if(!token || !hello || first) { finishError(code,message); return; }
    const now=d.now(); if(!deadline) deadline=now+RESUME_MS;
    if(now>=deadline) {finishError('RESUME_TIMEOUT','Reconnect window expired');return;}
    const delay=Math.min(deadline-now,Math.min(5000,250*2**Math.min(retry++,5))*(0.75+0.5*d.random()));
    const generation=epoch;
    setStatus('reconnecting',code,message);
    if(epoch!==generation || status.phase!=='reconnecting') return;
    reconnect=d.schedule(()=>{reconnect=undefined;if(epoch===generation) open();},delay);
  }
  function rawSend(raw:string):void {
    if(!ws || ws.readyState!==1) throw failure('NOT_CONNECTED','Socket is not open');
    if(ws.bufferedAmount+bytes(raw)>FRAME_LIMIT) throw failure('BACKPRESSURE','Socket send buffer is full');
    ws.send(raw);
  }
  function pack(message:ClientMessage):string {
    const raw=d.encode(message);
    if(bytes(raw)>COMMAND_LIMIT) throw failure('FRAME_LIMIT','Client frame exceeds 16 KiB');
    d.parseClient(raw); return raw;
  }
  function rateAvailable(now:number):boolean {
    while(commandTimes.length && commandTimes[0]<=now-1000) commandTimes.shift();
    return commandTimes.length<30;
  }
  function flush():void {
    if(!active()) return;
    const now=d.now();
    for(const entry of pending.values()) {
      if(entry.epoch===epoch) continue;
      if(!rateAvailable(now)) break;
      rawSend(entry.raw); entry.epoch=epoch; entry.sent=now; commandTimes.push(now);
    }
  }
  function tick(generation:number):void {
    if(generation!==epoch || !active()) return;
    const now=d.now();
    if(now-lastPong>=PONG_TIMEOUT || [...pending.values()].some(p=>p.epoch===epoch && now-p.sent>=RESULT_TIMEOUT)) {
      lose('TIMEOUT','Host response timed out'); return;
    }
    try {
      flush();
      if(pingAt===null && now>=nextPing) {pingAt=Math.floor(now);pingSent=now;rawSend(pack({type:'ping',at:pingAt}));nextPing=now+PING_MS;}
    } catch {lose('SEND_FAILED','Unable to send to host');return;}
    service=d.schedule(()=>tick(generation),100);
  }
  function onMessage(raw:unknown,generation:number):void {
    if(generation!==epoch) return;
    let message:ServerMessage;
    try {
      if(typeof raw!=='string' || raw.length>FRAME_LIMIT || bytes(raw)>FRAME_LIMIT) throw failure('FRAME_LIMIT','Invalid server frame');
      message=d.parseServer(raw);
    } catch {finishError('INVALID_FRAME','Invalid server message');return;}
    if(message.type==='error') {
      if(status.phase!=='connected' || /version|digest|protocol|content|resume|shutdown|host.stop/i.test(message.code)) {
        finishError(message.code,message.message); publish(message);
      } else publish(message);
      return;
    }
    if(message.type==='welcome') {
      if(active() || !hello || message.room.protocolVersion!==PROTOCOL_VERSION || message.room.contentDigest!==hello.contentDigest ||
        (roomId!==null && (roomId!==message.room.id || status.playerId!==message.playerId)) ||
        (runId!==null && runId!==message.room.options.runId)) {finishError('SESSION_MISMATCH','Host session is incompatible');return;}
      if(timeout!==undefined) d.cancel(timeout); timeout=undefined;
      token=message.resumeToken; roomId=message.room.id; runId=message.room.options.runId;
      status.playerId=message.playerId; retry=0;deadline=0;lastPong=d.now();nextPing=lastPong;
      if(!first) buffer.resetInterpolation();
      const waiter=first;first=null;setStatus('connected');
      if(generation!==epoch) {waiter?.reject(failure('CLOSED','Connection closed'));return;}
      waiter?.resolve();publish(message);tick(generation);return;
    }
    if(!active()) {finishError('HANDSHAKE_REQUIRED','Welcome required before game data');return;}
    switch(message.type) {
      case 'snapshot': {
        if(message.state.options.runId!==runId) {finishError('SESSION_MISMATCH','Snapshot belongs to a different run');return;}
        if(!buffer.accept(message.seq,message.state,d.now())) return;
        const events=buffer.events(message.events);
        publish({...message,events});return;
      }
      case 'result': if(!pending.delete(message.seq)) return; break;
      case 'runResult':
        if(message.result.runId!==runId || message.result.contentDigest!==hello?.contentDigest || runResults.has(message.result.runId)) return;
        runResults.add(message.result.runId);break;
      case 'room':
        if(message.room.id!==roomId || message.room.options.runId!==runId || message.room.contentDigest!==hello?.contentDigest || message.room.protocolVersion!==PROTOCOL_VERSION) {finishError('SESSION_MISMATCH','Room changed unexpectedly');return;}break;
      case 'pong':
        if(message.at!==pingAt) return;
        lastPong=d.now();pingAt=null;status={...status,latencyMs:Math.max(0,lastPong-pingSent)};notify(statuses,status);break;
    }
    publish(message);
  }
  function open():void {
    if(!hello) return;
    if(deadline && d.now()>=deadline) {finishError('RESUME_TIMEOUT','Reconnect window expired');return;}
    const generation=++epoch;
    try {ws=d.socket(url);} catch {lose('CONNECT_FAILED','Unable to open WebSocket');return;}
    const socket=ws;
    timeout=d.schedule(()=>{if(generation===epoch) lose('HANDSHAKE_TIMEOUT','Host did not welcome client');},Math.min(HANDSHAKE_MS,deadline?deadline-d.now():HANDSHAKE_MS));
    socket.onopen=()=>{
      if(generation!==epoch || !hello) return;
      try {rawSend(pack({...hello,...(token?{resumeToken:token}:{})}));} catch {lose('JOIN_FAILED','Unable to send handshake');}
    };
    socket.onmessage=e=>onMessage(e.data,generation);
    socket.onerror=()=>{if(generation===epoch) lose('SOCKET_ERROR','WebSocket error');};
    socket.onclose=e=>{if(generation===epoch) lose('DISCONNECTED',`Connection closed (${e.code})`);};
  }
  function send(message:Outgoing):void {
    if(!active()) throw failure('NOT_CONNECTED','Connection is not ready');
    if(message.type==='ping') {
      if(pingAt!==null) return;
      const raw=pack(message);rawSend(raw);pingAt=message.at;pingSent=d.now();nextPing=pingSent+PING_MS;return;
    }
    if(message.type!=='command') {rawSend(pack(message));return;}
    const m:Command=message;
    if(!Number.isSafeInteger(m.seq) || m.seq<=lastSeq) throw failure('SEQ','Command sequence must increase');
    if(pending.size>=MAX_PENDING || !rateAvailable(d.now())) throw failure('RATE_LIMIT','Too many commands');
    const raw=pack(m);
    // Record before transmission; a transport exception has an ambiguous outcome.
    lastSeq=m.seq;pending.set(m.seq,{raw,sent:0,epoch:-1});
    try {flush();} catch {lose('SEND_FAILED','Command delivery interrupted');}
  }
  return {
    connect(address,join) {
      if(['connected','connecting','reconnecting'].includes(status.phase)) return Promise.reject(failure('BUSY','Connection already active'));
      let parsed:URL;
      try {
        parsed=new URL(address);if(!['ws:','wss:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.hash) throw failure('URL','Invalid WebSocket address');
        if(join.protocolVersion!==PROTOCOL_VERSION) throw failure('VERSION','Unsupported protocol version');
        pack(join);
      } catch(e) {return Promise.reject(e);}
      detach();buffer.clear();pending.clear();commandTimes.length=0;runResults.clear();lastSeq=retry=deadline=0;
      status={phase:'idle',playerId:null,latencyMs:null};url=parsed.href;hello=structuredClone(join);token=join.resumeToken;roomId=runId=null;
      const promise=new Promise<void>((resolve,reject)=>{first={resolve,reject};});
      const generation=epoch;setStatus('connecting');if(generation===epoch) open();return promise;
    },
    send,
    command(action) {
      const seq=lastSeq+1;
      const {actor: _actor, requestId: _requestId, ...intent}=action;
      try {send({type:'command',seq,command:intent as GameAction});return {ok:false,pending:true,requestId:String(seq)};}
      catch(e){return {ok:false,reason:e instanceof CoopClientError?e.code:'INVALID_COMMAND'};}
    },
    subscribe(listener) {listeners.add(listener);return ()=>{listeners.delete(listener);};},
    subscribeStatus(listener) {statuses.add(listener);return ()=>{statuses.delete(listener);};},
    status:()=>({...status}),
    getSnapshot:()=>{const state=buffer.latest();return state?structuredClone(state):null;},
    sample:(now=d.now())=>buffer.sample(now),
    close() {
      if(status.phase==='closed') return;
      detach();const waiter=first;first=null;waiter?.reject(failure('CLOSED','Connection closed'));
      hello=null;token=undefined;roomId=runId=null;pending.clear();buffer.clear();runResults.clear();commandTimes.length=0;
      status={phase:'closed',latencyMs:null,playerId:null};notify(statuses,status);statuses.clear();listeners.clear();
    },
  };
}
