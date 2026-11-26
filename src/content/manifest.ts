import { CONTRACT_VERSION, PROTOCOL_VERSION } from '../contracts';
import type { GameConfig, Profile, CampaignNode, ClientMessage } from '../contracts';
import type { ContentManifest } from '../contracts/coop';

export const CONTENT_VERSION = '1.0.0';
export const SCHEMA_VERSION = CONTRACT_VERSION;
export const compareText = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export const byId = <T extends {id:string}>(items: readonly T[]): T[] => [...items].sort((a,b)=>compareText(a.id,b.id));

/** Canonical JSON: object keys sorted, semantic arrays kept in order. */
export function canonical(value: unknown): string {
  const active = new Set<object>();
  function encode(v: unknown): string {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new Error('Non-finite content number');
      return JSON.stringify(v);
    }
    if (typeof v !== 'object') throw new Error(`Non-data content: ${typeof v}`);
    if (active.has(v)) throw new Error('Cyclic content');
    active.add(v);
    let result: string;
    if (Array.isArray(v)) {
      result = '[' + Array.from(v, encode).join(',') + ']';
    } else {
      if (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) throw new Error('Non-plain content object');
      result = '{' + Object.keys(v).sort(compareText).filter(k => (v as Record<string,unknown>)[k] !== undefined)
        .map(k=>JSON.stringify(k)+':'+encode((v as Record<string,unknown>)[k])).join(',') + '}';
    }
    active.delete(v);
    return result;
  }
  return encode(value);
}

// Synchronous SHA-256, using identical ECMAScript operations in Node and renderer.
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
const rotr = (x:number,n:number) => (x>>>n)|(x<<(32-n));
export function sha256(text:string): string {
  const input = new TextEncoder().encode(text);
  const bytes = new Uint8Array(Math.ceil((input.length+9)/64)*64);
  bytes.set(input); bytes[input.length]=128;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length-8, Math.floor(input.length/0x20000000));
  view.setUint32(bytes.length-4, input.length*8);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64);
  for(let offset=0;offset<bytes.length;offset+=64){
    for(let i=0;i<16;i++) w[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++){
      const x=w[i-15],y=w[i-2];
      w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0;
    }
    let [a,b,c,d,e,f,g,j]=h;
    for(let i=0;i<64;i++){
      const t1=(j+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
      const t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,j].forEach((v,i)=>{h[i]=(h[i]+v)>>>0;});
  }
  return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}

export function assetKey(value:string, directory:string):string {
  if (typeof value !== 'string' || !value || /[\\%?#:\s]/.test(value)) throw new Error(`Invalid resource key: ${value}`);
  const key = value.replace(/^\//,'').replace(/^public\//,'');
  const path = key.includes('/') ? key : `${directory}/${key}`;
  if (!path.startsWith('art/') || path.split('/').some(p=>!p || p==='.' || p==='..')) throw new Error(`Invalid resource key: ${value}`);
  return path;
}
export function resourceKeys(config:GameConfig):string[] {
  const keys = new Set<string>();
  for(const t of config.towers){
    const dir=`art/towers/${t.id}`;
    keys.add(assetKey(t.visual.asset,dir));
    for(const p of ['a','b','c']){
      for(let n=1;n<=5;n++) keys.add(`${dir}/${p}${n}.svg`);
      for(let n=1;n<=2;n++) keys.add(`${dir}/${p}${n}-overlay.svg`);
    }
    keys.add(`${dir}/base.svg`);
    for(const p of t.paths) for(const u of p.upgrades) keys.add(assetKey(u.visual.asset,dir));
  }
  for(const m of config.maps) keys.add(assetKey(m.background,`art/maps/${m.id}`));
  for(const e of config.enemies) keys.add(`art/${e.boss?'bosses':'enemies'}/${e.id}.svg`);
  for(const k of config.knowledge) keys.add(assetKey(k.icon,'art/knowledge'));
  return [...keys].sort(compareText);
}
export function contentDigest(config:GameConfig, hashes:Readonly<Record<string,string>>):string {
  const {contentDigest: _digest, endlessWave: _function, ...data}=config;
  // Registry order is not semantic; lanes, paths, layers and wave groups are.
  const normalized={...data,towers:byId(data.towers),maps:byId(data.maps),enemies:byId(data.enemies),modes:byId(data.modes),campaign:byId(data.campaign),knowledge:byId(data.knowledge),difficulties:byId(data.difficulties),waves:[...data.waves].sort((a,b)=>a.number-b.number)};
  const resources=resourceKeys(config).map(key=>[key, hashes[key] ?? null]);
  return sha256(canonical({schema:SCHEMA_VERSION,protocol:PROTOCOL_VERSION,data:normalized,resources}));
}
export interface ReleaseManifest extends ContentManifest {
  contentVersion:string; contentDigest:string; resources:string[];
}
export function createManifest(config:GameConfig):ReleaseManifest {
  return {version:config.contentVersion,contentVersion:config.contentVersion,schema:SCHEMA_VERSION,protocol:PROTOCOL_VERSION,contentDigest:config.contentDigest,towers:byId(config.towers).map(t=>t.id),maps:byId(config.maps).map(m=>m.id),modes:byId(config.modes).map(m=>m.id),resources:resourceKeys(config)};
}
export function compatibilityError(config:GameConfig, hello:Pick<Extract<ClientMessage,{type:'join'}>,'protocolVersion'|'contentDigest'>):'protocol-mismatch'|'content-mismatch'|null {
  if(hello.protocolVersion!==PROTOCOL_VERSION) return 'protocol-mismatch';
  return hello.contentDigest===config.contentDigest?null:'content-mismatch';
}
/** Idempotent additive migration. Never removes an unknown or retired ID. */
export function reconcileCampaignRewards(profile:Profile,nodes:readonly CampaignNode[]):Profile {
  const completed=new Set(profile.completedNodes);
  const unlocked=new Set(profile.unlockedTowers);
  for(const n of nodes) if(completed.has(n.id)) for(const reward of n.unlocks) unlocked.add(reward);
  return {...profile,unlockedTowers:[...unlocked]};
}
