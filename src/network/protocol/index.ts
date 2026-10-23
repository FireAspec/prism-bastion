import type {ClientMessage,ServerMessage} from '../../contracts';
import {clientMessage,serverMessage,plainData,ProtocolError,natural} from './schema';

export {ProtocolError} from './schema';
export type {ErrorCode} from './schema';

export const COMMAND_FRAME_BYTES=16*1024;
export const SNAPSHOT_FRAME_BYTES=2*1024*1024;
export const MAX_COMMANDS_PER_SECOND=30;
const encoder=new TextEncoder();

function bytes(raw:string,max:number):number {
  // A fast preflight avoids allocating a large UTF-8 array for oversized input.
  if(raw.length>max)throw new ProtocolError('FRAME_TOO_LARGE');
  const size=encoder.encode(raw).byteLength;
  if(size>max)throw new ProtocolError('FRAME_TOO_LARGE');
  return size;
}

function decode(raw:string,max:number):unknown {
  if(typeof raw!=='string')throw new ProtocolError('INVALID_TYPE');
  bytes(raw,max);
  let value:unknown;
  try {value=JSON.parse(raw) as unknown;}
  catch {throw new ProtocolError('INVALID_JSON');}
  return plainData(value);
}

/** Parse a client frame. The host supplies actor from the authenticated socket, never the packet. */
export function parseClient(raw:string):ClientMessage {
  const value=decode(raw,COMMAND_FRAME_BYTES);
  clientMessage(value,'$');
  return value as ClientMessage;
}

/** Parse a server frame including a complete, bounded and validated game snapshot. */
export function parseServer(raw:string):ServerMessage {
  const value=decode(raw,SNAPSHOT_FRAME_BYTES);
  if((value as ServerMessage | null)?.type!=='snapshot')bytes(raw,COMMAND_FRAME_BYTES);
  serverMessage(value,'$');
  return value as ServerMessage;
}

/** Validate BEFORE stringification, allowing only declared optional omissions. */
export function encode(message:ClientMessage|ServerMessage):string {
  const safe=plainData(message);
  if(safe===null||typeof safe!=='object'||Array.isArray(safe))throw new ProtocolError('INVALID_TYPE');
  const type=(safe as {type?:unknown}).type;
  if(typeof type!=='string')throw new ProtocolError('INVALID_ENUM','$.type');
  if(['join','command','ready','start','ping'].includes(type))clientMessage(safe,'$');
  else serverMessage(safe,'$');
  const json=JSON.stringify(safe);
  bytes(json,type==='snapshot'?SNAPSHOT_FRAME_BYTES:COMMAND_FRAME_BYTES);
  return json;
}

/** Each authenticated client/socket needs its own tracker. Also use one for server snapshot seq. */
export function createSequenceGuard(initial=-1):{
  accept:(seq:number)=>void; reset:(nextInitial?:number)=>void; last:()=>number;
} {
  if(!Number.isSafeInteger(initial)||initial< -1)throw new ProtocolError('INVALID_SEQUENCE');
  let latest=initial;
  return {
    accept(seq:number):void {
      natural(seq,'$.seq');
      if(seq<=latest)throw new ProtocolError('REPLAYED_SEQUENCE','$.seq');
      latest=seq;
    },
    reset(nextInitial=-1):void {
      if(!Number.isSafeInteger(nextInitial)||nextInitial< -1)throw new ProtocolError('INVALID_SEQUENCE');
      latest=nextInitial;
    },
    last:()=>latest,
  };
}

/** Sliding one-second host-side limiter, scoped to one authenticated client. */
export function createCommandRateLimiter(limit=MAX_COMMANDS_PER_SECOND):{
  accept:(atMs:number)=>void; reset:()=>void;
} {
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new ProtocolError('OUT_OF_RANGE');
  const times:number[]=[];
  let latest=-1;
  return {
    accept(atMs:number):void {
      if(!Number.isFinite(atMs)||atMs<0||atMs<latest)throw new ProtocolError('OUT_OF_RANGE','$.time');
      latest=atMs;
      while(times.length&&atMs-times[0]>=1000)times.shift();
      if(times.length>=limit)throw new ProtocolError('RATE_LIMIT');
      times.push(atMs);
    },
    reset():void {times.length=0;latest=-1;},
  };
}

/** Host must call this before admitting a player or starting/resuming a run. */
export function assertJoinCompatible(
  join:Extract<ClientMessage,{type:'join'}>,
  expectedDigest:string,
):void {
  const safe=plainData(join) as Extract<ClientMessage,{type:'join'}>;
  if(safe.protocolVersion!==1)throw new ProtocolError('PROTOCOL_MISMATCH','$.protocolVersion');
  clientMessage(safe,'$');
  if(safe.contentDigest!==expectedDigest)throw new ProtocolError('CONTENT_MISMATCH','$.contentDigest');
}
