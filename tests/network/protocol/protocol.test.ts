import {describe,it,expect} from 'vitest';
import type {ClientMessage,ServerMessage} from '../../../src/contracts';
import {
  parseClient,parseServer,encode,ProtocolError,createSequenceGuard,createCommandRateLimiter,
  assertJoinCompatible,COMMAND_FRAME_BYTES,SNAPSHOT_FRAME_BYTES,
} from '../../../src/network/protocol';
import {
  DIGEST,gameState,clientFixtures,serverFixtures,invalidClientFixtures,invalidServerFixtures,
} from './fixtures';

function errorCode(action:()=>unknown):string|undefined {
  try {action();return undefined;}catch(err) {
    expect(err).toBeInstanceOf(ProtocolError);
    return (err as ProtocolError).code;
  }
}

describe('protocol v1 round-trip',()=>{
  it.each(clientFixtures().map((packet,i)=>[String(i)+' '+packet.type,packet] as const))
  ('serializes and parses client %s',(_label,packet)=>{
    expect(parseClient(encode(packet))).toEqual(packet);
  });
  it.each(serverFixtures().map((packet,i)=>[String(i)+' '+packet.type,packet] as const))
  ('serializes and parses server %s',(_label,packet)=>{
    expect(parseServer(encode(packet))).toEqual(packet);
  });
  it('does not convert legitimate optional omissions into null',()=>{
    const parsed=parseClient(encode({type:'join',protocolVersion:1,contentDigest:DIGEST,name:'A',password:''}));
    expect('resumeToken' in parsed).toBe(false);
    expect('knowledge' in parsed).toBe(false);
  });
  it('serializes explicitly undefined optional properties as absent, but not unknown properties',()=>{
    const join:Extract<ClientMessage,{type:'join'}>={type:'join',protocolVersion:1,
      contentDigest:DIGEST,name:'A',password:'',resumeToken:undefined};
    expect(JSON.parse(encode(join))).not.toHaveProperty('resumeToken');
    expect(errorCode(()=>encode({...join,admin:undefined} as ClientMessage))).toBe('UNKNOWN_FIELD');
  });
});

describe('invalid fixtures (every message variant)',()=>{
  it.each(invalidClientFixtures())('$label',({packet,code})=>{
    expect(errorCode(()=>encode(packet as ClientMessage))).toBe(code);
    // JSON cannot represent Infinity; other malformed values must also fail on inbound.
    if(!JSON.stringify(packet).includes('null')||code!=='INVALID_NUMBER') {
      const inbound=errorCode(()=>parseClient(JSON.stringify(packet)));
      if(code!=='INVALID_NUMBER')expect(inbound).toBe(code);
    }
  });
  it.each(invalidServerFixtures())('$label',({packet,code})=>{
    expect(errorCode(()=>encode(packet as ServerMessage))).toBe(code);
    if(code!=='INVALID_NUMBER')expect(errorCode(()=>parseServer(JSON.stringify(packet)))).toBe(code);
  });
  it('rejects malformed, null, arrays, primitive roots and missing type',()=>{
    for(const raw of ['','{','not-json','null','[]','42','"x"','true','{}','{"type":123}'])
      expect(errorCode(()=>parseClient(raw))).toBeDefined();
  });
  it('rejects inconsistent room membership and unrecognized nested snapshot properties',()=>{
    const welcome=serverFixtures()[0] as Extract<ServerMessage,{type:'welcome'}>;
    welcome.room.ready=['stranger'];
    expect(errorCode(()=>encode(welcome))).toBe('OUT_OF_RANGE');
    const snapshot=serverFixtures()[2] as Extract<ServerMessage,{type:'snapshot'}>;
    expect(errorCode(()=>encode({...snapshot,state:{...snapshot.state,admin:true}} as ServerMessage))).toBe('UNKNOWN_FIELD');
  });
  it('rejects NaN, Infinity, oversized integers, negative resources and invalid enum values',()=>{
    const cases=[NaN,Infinity,-Infinity];
    for(const n of cases) {
      expect(errorCode(()=>encode({type:'ping',at:n}))).toBe('INVALID_NUMBER');
      const state=gameState();state.credits=n;
      expect(errorCode(()=>encode({type:'snapshot',seq:1,state,events:[]}))).toBe('INVALID_NUMBER');
    }
    expect(errorCode(()=>parseClient('{"type":"command","seq":9007199254740992,"command":{"type":"startWave"}}'))).toBe('OUT_OF_RANGE');
  });
});

describe('untrusted JSON / prototype safety',()=>{
  it('rejects dangerous keys at every depth without mutating prototypes',()=>{
    for(const key of ['__proto__','prototype','constructor']) {
      const raw=`{"type":"command","seq":1,"command":{"type":"place","tower":"needle","pos":{"x":1,"y":2,"${key}":{"polluted":true}}}}`;
      expect(errorCode(()=>parseClient(raw))).toBe('UNSAFE_KEY');
      expect(({} as {polluted?:boolean}).polluted).toBeUndefined();
    }
    expect(errorCode(()=>parseServer('{"type":"error","code":"a","message":"b","__proto__":{"polluted":true}}'))).toBe('UNSAFE_KEY');
  });
  it('rejects accessors, inherited toJSON, class instances, cycles and sparse arrays before encode',()=>{
    const getter={type:'start'} as {type:string;evil?:string};
    Object.defineProperty(getter,'evil',{enumerable:true,get(){throw Error('getter must not run');}});
    expect(errorCode(()=>encode(getter as ClientMessage))).toBe('UNSAFE_KEY');
    const instance=Object.assign(new class {type='start';}(),{});
    expect(errorCode(()=>encode(instance as ClientMessage))).toBe('UNSAFE_KEY');
    const loop:Record<string,unknown>={type:'start'};loop.self=loop;
    expect(errorCode(()=>encode(loop as ClientMessage))).toBe('TOO_COMPLEX');
    const sparse:string[]=[];sparse.length=4;
    expect(errorCode(()=>encode({type:'join',name:'X',password:'',protocolVersion:1,contentDigest:DIGEST,knowledge:sparse}))).toBe('UNSAFE_KEY');
    const toJson={type:'start',toJSON:()=>{throw Error('must not run');}};
    expect(errorCode(()=>encode(toJson as ClientMessage))).toBe('INVALID_TYPE');
  });
  it('rejects enormous nested arrays and excessive nesting',()=>{
    const nested='['.repeat(34)+'0'+']'.repeat(34);
    expect(errorCode(()=>parseServer(nested))).toBe('TOO_COMPLEX');
    const giant=JSON.stringify({type:'join',name:'X',password:'',protocolVersion:1,contentDigest:DIGEST,knowledge:Array(8200).fill('x')});
    expect(errorCode(()=>parseClient(giant))).toBe('FRAME_TOO_LARGE');
  });
  it('never executes code embedded in a field',()=>{
    const payload='{"type":"ping","at":0,"evil":"(() => { globalThis.polluted = true })()"}';
    expect(errorCode(()=>parseClient(payload))).toBe('UNKNOWN_FIELD');
    expect((globalThis as {polluted?:boolean}).polluted).toBeUndefined();
  });
  it('never echoes attacker-controlled key text in error messages',()=>{
    const secret='opaque-token-from-private-session';
    try {parseClient(JSON.stringify({type:'start',[secret]:true}));}
    catch(err){expect(String(err)).not.toContain(secret);}
  });
});

describe('frame sizes and adversarial input',()=>{
  const utf8=new TextEncoder();
  it('enforces actual UTF-8 bytes (not JS string length) for commands',()=>{
    const packet={type:'join',protocolVersion:1,contentDigest:DIGEST,name:'Игрок',password:'',
      knowledge:Array.from({length:150},(_,i)=>`узел-${i.toString().padStart(3,'0')}-${'я'.repeat(60)}`)} as const;
    const raw=JSON.stringify(packet);
    expect(raw.length).toBeLessThan(COMMAND_FRAME_BYTES);
    expect(utf8.encode(raw).byteLength).toBeGreaterThan(COMMAND_FRAME_BYTES);
    expect(errorCode(()=>parseClient(raw))).toBe('FRAME_TOO_LARGE');
  });
  it('accepts a large valid command below 16 KiB, rejects one over the boundary',()=>{
    const packet={type:'join',protocolVersion:1,contentDigest:DIGEST,name:'Игрок',password:'',
      knowledge:Array.from({length:150},(_,i)=>`id${i.toString().padStart(3,'0')}-${'x'.repeat(94)}`)};
    const raw=JSON.stringify(packet);
    expect(utf8.encode(raw).byteLength).toBeLessThan(COMMAND_FRAME_BYTES);
    expect(parseClient(raw).type).toBe('join');
    packet.knowledge=packet.knowledge.map(v=>v+'z'.repeat(20));
    expect(errorCode(()=>parseClient(JSON.stringify(packet)))).toBe('FRAME_TOO_LARGE');
  });
  it('accepts exactly 16 KiB and rejects 16 KiB plus one byte',()=>{
    const packet={type:'join',protocolVersion:1,contentDigest:DIGEST,name:'A',password:'',
      knowledge:Array.from({length:150},(_,i)=>`k${i.toString().padStart(3,'0')}-${'x'.repeat(70)}`)};
    let remaining=COMMAND_FRAME_BYTES-utf8.encode(JSON.stringify(packet)).byteLength;
    expect(remaining).toBeGreaterThan(0);
    for(let i=0;i<packet.knowledge.length&&remaining>0;i++) {
      const extra=Math.min(128-packet.knowledge[i].length,remaining);
      packet.knowledge[i]+='x'.repeat(extra);remaining-=extra;
    }
    expect(remaining).toBe(0);
    expect(utf8.encode(JSON.stringify(packet)).byteLength).toBe(COMMAND_FRAME_BYTES);
    expect(parseClient(JSON.stringify(packet)).type).toBe('join');
    packet.knowledge[0]+='y';
    expect(errorCode(()=>parseClient(JSON.stringify(packet)))).toBe('FRAME_TOO_LARGE');
  });
  it('enforces 2 MiB for snapshots, and 16 KiB for all other server frames',()=>{
    const packet=serverFixtures()[2] as Extract<ServerMessage,{type:'snapshot'}>;
    packet.events=Array.from({length:3500},(_,id)=>({id,time:0,kind:'hit' as const,
      visual:'x'.repeat(240),fromVisual:'y'.repeat(120),toVisual:'z'.repeat(120)}));
    const raw=JSON.stringify(packet);
    expect(utf8.encode(raw).byteLength).toBeGreaterThan(COMMAND_FRAME_BYTES);
    expect(utf8.encode(raw).byteLength).toBeLessThan(SNAPSHOT_FRAME_BYTES);
    expect(parseServer(raw).type).toBe('snapshot');
    packet.events=Array.from({length:8000},(_,id)=>({id,time:0,kind:'hit' as const,visual:'x'.repeat(240),fromVisual:'y'.repeat(120),toVisual:'z'.repeat(120)}));
    expect(errorCode(()=>parseServer(JSON.stringify(packet)))).toBe('FRAME_TOO_LARGE');
    const hugeRoom={type:'error',code:'A',message:'x'.repeat(16384)};
    expect(errorCode(()=>parseServer(JSON.stringify(hugeRoom)))).toBe('FRAME_TOO_LARGE');
  });
  it('accepts exactly 2 MiB snapshot, rejects one byte extra',()=>{
    const packet=serverFixtures()[2] as Extract<ServerMessage,{type:'snapshot'}>;
    packet.events=Array.from({length:4000},(_,id)=>({id,time:0,kind:'hit' as const,
      visual:'',fromVisual:'',toVisual:''}));
    let remaining=SNAPSHOT_FRAME_BYTES-utf8.encode(JSON.stringify(packet)).byteLength;
    expect(remaining).toBeGreaterThan(0);
    for(const event of packet.events)for(const key of ['visual','fromVisual','toVisual'] as const) {
      const mutable=event as {visual:string;fromVisual:string;toVisual:string};
      const extra=Math.min(256,remaining);mutable[key]+='x'.repeat(extra);remaining-=extra;
      if(remaining===0)break;
    }
    expect(remaining).toBe(0);
    expect(utf8.encode(JSON.stringify(packet)).byteLength).toBe(SNAPSHOT_FRAME_BYTES);
    expect(parseServer(JSON.stringify(packet)).type).toBe('snapshot');
    (packet.events[0] as {visual:string}).visual+='y';
    expect(errorCode(()=>parseServer(JSON.stringify(packet)))).toBe('FRAME_TOO_LARGE');
  });
  it('survives deterministic malformed-JSON fuzz without side effects',()=>{
    let seed=0x12345678;
    for(let i=0;i<1000;i++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const junk=String.fromCharCode(seed&127).repeat(seed%48+1);
      const raw=i%2?`{"type":"start",${junk}#`:`${junk}#{"type":"ping","at":1}`;
      expect(errorCode(()=>parseClient(raw))).toBeDefined();
      expect(errorCode(()=>parseServer(raw))).toBeDefined();
    }
  });
});

describe('host-side sequencing and handshake helpers',()=>{
  it('rejects replay, reordering and invalid sequence, allows wrap-free progression',()=>{
    const guard=createSequenceGuard();
    guard.accept(1);guard.accept(2);guard.accept(900);
    expect(errorCode(()=>guard.accept(900))).toBe('REPLAYED_SEQUENCE');
    expect(errorCode(()=>guard.accept(899))).toBe('REPLAYED_SEQUENCE');
    expect(errorCode(()=>guard.accept(-1))).toBe('OUT_OF_RANGE');
    guard.reset();guard.accept(1);expect(guard.last()).toBe(1);
    guard.reset();guard.accept(0);expect(guard.last()).toBe(0);
  });
  it('limits each client to thirty commands per sliding second',()=>{
    const guard=createCommandRateLimiter();
    for(let i=0;i<30;i++)guard.accept(i);
    expect(errorCode(()=>guard.accept(30))).toBe('RATE_LIMIT');
    guard.accept(1000);
    guard.reset();guard.accept(0);
    expect(errorCode(()=>guard.accept(-1))).toBe('OUT_OF_RANGE');
  });
  it('compares digests without exposing resume token',()=>{
    const hello=clientFixtures()[1] as Extract<ClientMessage,{type:'join'}>;
    expect(()=>assertJoinCompatible(hello,DIGEST)).not.toThrow();
    expect(errorCode(()=>assertJoinCompatible(hello,'0'.repeat(64)))).toBe('CONTENT_MISMATCH');
    expect(errorCode(()=>assertJoinCompatible({...hello,protocolVersion:2} as unknown as typeof hello,DIGEST))).toBe('PROTOCOL_MISMATCH');
    const error=errorCode(()=>parseClient(JSON.stringify({...hello,name:''})));
    expect(error).toBe('OUT_OF_RANGE');
    try {parseClient(JSON.stringify({...hello,name:''}));}catch(err) {
      expect(String(err)).not.toContain('opaque-token');
    }
  });
});
