/** Runtime wire schemas. No browser, Electron or Node dependencies. */
import {legalTiers} from '../../contracts/rules';

export type ErrorCode =
  | 'INVALID_JSON' | 'INVALID_TYPE' | 'INVALID_NUMBER' | 'OUT_OF_RANGE'
  | 'INVALID_ENUM' | 'UNKNOWN_FIELD' | 'MISSING_FIELD' | 'UNSAFE_KEY'
  | 'TOO_COMPLEX' | 'FRAME_TOO_LARGE' | 'INVALID_SEQUENCE'
  | 'REPLAYED_SEQUENCE' | 'RATE_LIMIT' | 'PROTOCOL_MISMATCH'
  | 'CONTENT_MISMATCH';

const explanations: Record<ErrorCode,string> = {
  INVALID_JSON:'Некорректный JSON в сетевом сообщении',
  INVALID_TYPE:'Недопустимый тип поля сетевого сообщения',
  INVALID_NUMBER:'Число должно быть конечным',
  OUT_OF_RANGE:'Значение выходит за допустимые пределы',
  INVALID_ENUM:'Неизвестное значение перечисления',
  UNKNOWN_FIELD:'Неизвестное поле сетевого сообщения',
  MISSING_FIELD:'Отсутствует обязательное поле сетевого сообщения',
  UNSAFE_KEY:'Обнаружено небезопасное имя поля или объект',
  TOO_COMPLEX:'Сетевое сообщение слишком сложное',
  FRAME_TOO_LARGE:'Превышен допустимый размер сетевого кадра',
  INVALID_SEQUENCE:'Недопустимый порядковый номер сообщения',
  REPLAYED_SEQUENCE:'Повторный или устаревший порядковый номер',
  RATE_LIMIT:'Превышена частота сетевых команд',
  PROTOCOL_MISMATCH:'Версия сетевого протокола не совпадает',
  CONTENT_MISMATCH:'Содержимое игры у участников различается',
};

export class ProtocolError extends Error {
  readonly code:ErrorCode;
  readonly path:string;
  constructor(code:ErrorCode,path='$') {
    super(`${explanations[code]} (${path})`);
    this.name='ProtocolError'; this.code=code; this.path=path;
  }
}

export type Check = (value:unknown,path:string)=>void;
type Fields = Record<string,Check>;
const forbidden = new Set(['__proto__','prototype','constructor']);
const MAX_DEPTH=32;
const MAX_NODES=300_000;
const MAX_ARRAY=8192;
const MAX_KEYS=4096;
const MAX_STRING=32768;

/** Make a data-only copy before validation/serialization: no getters, cycles or inherited toJSON. */
export function plainData(value:unknown):unknown {
  const active = new WeakSet<object>();
  let nodes=0;
  function visit(input:unknown,depth:number,path:string):unknown {
    if(++nodes>MAX_NODES||depth>MAX_DEPTH)throw new ProtocolError('TOO_COMPLEX',path);
    if(input===null||typeof input==='boolean')return input;
    if(typeof input==='string') {
      if(input.length>MAX_STRING)throw new ProtocolError('OUT_OF_RANGE',path);
      return input;
    }
    if(typeof input==='number') {
      if(!Number.isFinite(input))throw new ProtocolError('INVALID_NUMBER',path);
      return input;
    }
    if(typeof input!=='object')throw new ProtocolError('INVALID_TYPE',path);
    if(active.has(input))throw new ProtocolError('TOO_COMPLEX',path);
    const array=Array.isArray(input);
    const proto=Object.getPrototypeOf(input);
    if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)
      throw new ProtocolError('UNSAFE_KEY',path);
    active.add(input);
    const keys=Reflect.ownKeys(input);
    if(array) {
      if(input.length>MAX_ARRAY||keys.length>MAX_ARRAY+1)throw new ProtocolError('TOO_COMPLEX',path);
      const out:unknown[]=[];
      for(let i=0;i<input.length;i++) {
        const descriptor=Object.getOwnPropertyDescriptor(input,String(i));
        if(!descriptor||!('value' in descriptor))throw new ProtocolError('UNSAFE_KEY',`${path}[${i}]`);
        out.push(visit(descriptor.value,depth+1,`${path}[${i}]`));
      }
      if(keys.some(key=>key!=='length'&&(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=input.length)))
        throw new ProtocolError('UNSAFE_KEY',path);
      active.delete(input);return out;
    }
    if(keys.length>MAX_KEYS)throw new ProtocolError('TOO_COMPLEX',path);
    const out:Record<string,unknown>=Object.create(null);
    for(const key of keys) {
      if(typeof key!=='string'||forbidden.has(key))throw new ProtocolError('UNSAFE_KEY',path);
      const descriptor=Object.getOwnPropertyDescriptor(input,key);
      if(!descriptor||!descriptor.enumerable||!('value' in descriptor))throw new ProtocolError('UNSAFE_KEY',`${path}.[field]`);
      // An explicitly undefined optional property is legal in a JS object;
      // its wire representation is absence. The schema still checks the key.
      out[key]=descriptor.value===undefined?undefined:visit(descriptor.value,depth+1,`${path}.[field]`);
    }
    active.delete(input);return out;
  }
  return visit(value,0,'$');
}

export const boolean:Check=(v,p)=>{if(typeof v!=='boolean')throw new ProtocolError('INVALID_TYPE',p);};
export const finite:Check=(v,p)=>{if(typeof v!=='number')throw new ProtocolError('INVALID_TYPE',p);if(!Number.isFinite(v))throw new ProtocolError('INVALID_NUMBER',p);};
export function number(min=-Infinity,max=Infinity,integer=false):Check {
  return (v,p)=>{finite(v,p);const n=v as number;
    if(n<min||n>max||(integer&&!Number.isSafeInteger(n)))throw new ProtocolError('OUT_OF_RANGE',p);
  };
}
export const natural=number(0,Number.MAX_SAFE_INTEGER,true);
export const positiveSequence:Check=(v,p)=>{natural(v,p);if((v as number)===0)throw new ProtocolError('INVALID_SEQUENCE',p);};
export const amount=number(0,Number.MAX_SAFE_INTEGER);
export const nonnegative=number(0,1e12);
export const coordinate=number(-1e12,1e12);
export function string(min=0,max=256):Check {
  return (v,p)=>{
    if(typeof v!=='string')throw new ProtocolError('INVALID_TYPE',p);
    const size=[...v].length;
    if(size<min||size>max)throw new ProtocolError('OUT_OF_RANGE',p);
  };
}
export function enumeration<const T extends readonly (string|number)[]>(...values:T):Check {
  const allowed=new Set<unknown>(values);
  return (v,p)=>{if(!allowed.has(v))throw new ProtocolError('INVALID_ENUM',p);};
}
export function literal(expected:string|number):Check {
  return (v,p)=>{if(v!==expected)throw new ProtocolError('INVALID_ENUM',p);};
}
export function optional(inner:Check):Check {
  const check:Check=(v,p)=>{if(v!==undefined)inner(v,p);};
  Object.defineProperty(check,'optional',{value:true});return check;
}
export function shape(fields:Fields):Check {
  return (v,p)=>{
    if(v===null||typeof v!=='object'||Array.isArray(v))throw new ProtocolError('INVALID_TYPE',p);
    const obj=v as Record<string,unknown>;
    for(const key of Object.keys(obj)) {
      if(!Object.hasOwn(fields,key))throw new ProtocolError('UNKNOWN_FIELD',p);
    }
    for(const [key,check] of Object.entries(fields)) {
      if(!Object.hasOwn(obj,key)) {
        if(!Object.hasOwn(check,'optional'))throw new ProtocolError('MISSING_FIELD',`${p}.${key}`);
      }else check(obj[key],`${p}.${key}`);
    }
  };
}
export function list(item:Check,max=MAX_ARRAY,min=0):Check {
  return (v,p)=>{
    if(!Array.isArray(v))throw new ProtocolError('INVALID_TYPE',p);
    if(v.length<min||v.length>max)throw new ProtocolError('OUT_OF_RANGE',p);
    for(let i=0;i<v.length;i++)item(v[i],`${p}[${i}]`);
  };
}
export function dictionary(item:Check,max=512):Check {
  return (v,p)=>{
    if(v===null||typeof v!=='object'||Array.isArray(v))throw new ProtocolError('INVALID_TYPE',p);
    const obj=v as Record<string,unknown>,keys=Object.keys(obj);
    if(keys.length>max)throw new ProtocolError('OUT_OF_RANGE',p);
    for(const key of keys){string(1,128)(key,p);item(obj[key],`${p}.[key]`);}
  };
}
export function distinct(item:Check,max=256):Check {
  return (v,p)=>{
    list(item,max)(v,p);
    if(new Set(v as unknown[]).size!==(v as unknown[]).length)throw new ProtocolError('OUT_OF_RANGE',p);
  };
}

export const identifier=string(1,128);
export const digest:Check=(v,p)=>{string(64,64)(v,p);if(!/^[0-9a-f]{64}$/i.test(v as string))throw new ProtocolError('OUT_OF_RANGE',p);};
export const vec=shape({x:coordinate,y:coordinate});
const targeting=enumeration('first','last','strong','near');
const difficulty=enumeration('easy','normal','hard','extreme');
const element=enumeration('kinetic','fire','frost','electric','acid','energy');
const attackMode=enumeration('shot','cone','beam','chain','splash','ring','mortar','mine','drone','pulse','tide','melee');
const statusKind=enumeration('burn','poison','slow','freeze','stun','mark','shred','wet','reveal');
const phase=enumeration('build','wave','victory','defeat');
const eventKind=enumeration('shot','projectileSpawn','projectileImpact','strikeStart','strikeContact','miss','hit','layerBreak','shieldBreak','kill','leak','spawn','upgrade','place','sell','ability','bossPhase','waveStart','waveEnd','victory','defeat','income');
const colors=string(0,64);

const tiers:Check=(v,p)=>{
  list(number(0,5,true),3,3)(v,p);
  if(!legalTiers(v as [number,number,number]))throw new ProtocolError('OUT_OF_RANGE',p);
};
const status=shape({kind:statusKind,power:finite,duration:nonnegative,maxStacks:optional(number(1,100,true))});
const appliedStatus=shape({kind:statusKind,power:finite,duration:nonnegative,maxStacks:optional(number(1,100,true)),source:identifier,remaining:nonnegative,stacks:number(0,100,true)});
const attack=shape({
  mode:attackMode,element,damage:nonnegative,interval:nonnegative,range:nonnegative,
  pierce:nonnegative,count:nonnegative,splash:nonnegative,chains:nonnegative,chainRadius:nonnegative,
  detects:boolean,armorPierce:nonnegative,shieldMultiplier:nonnegative,bossMultiplier:nonnegative,
  executeBelow:number(0,1),push:finite,statuses:list(status,32),
  projectileSpeed:nonnegative,projectileRadius:nonnegative,homing:boolean,windup:nonnegative,arc:number(0,360),
});
const player=shape({id:identifier,name:string(1,24),color:colors,connected:boolean});
const runOptionsShape=shape({
  mapId:identifier,difficulty,seed:number(-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,true),
  endless:boolean,modeId:identifier,unlockedTowers:distinct(identifier,256),
  players:list(player,4,1),runId:identifier,knowledge:distinct(identifier,150),
});
const runOptions:Check=(v,p)=>{
  runOptionsShape(v,p);
  const players=(v as {players:{id:string}[]}).players;
  if(new Set(players.map(player=>player.id)).size!==players.length)
    throw new ProtocolError('OUT_OF_RANGE',`${p}.players`);
};
const rules=shape({
  incomeMul:nonnegative,startingCashMul:nonnegative,enemyHpMul:nonnegative,enemySpeedMul:nonnegative,towerCostMul:nonnegative,
  sellAllowed:boolean,maxLives:natural,allowAbilities:boolean,allowPassiveIncome:boolean,
  maxTowers:natural,maxTier:number(0,5,true),weather:enumeration('none','alternating','fog'),
  allowKnowledge:boolean,rounds:natural,roundRewardBase:nonnegative,roundRewardStep:nonnegative,popCashMul:nonnegative,
});
const tower=shape({
  id:identifier,defId:identifier,owner:identifier,pos:vec,tiers,targeting,invested:amount,
  cooldown:finite,abilityCooldowns:dictionary(finite),memory:dictionary(finite),
  damageDealt:nonnegative,kills:natural,generated:nonnegative,
});
const enemy=shape({
  id:identifier,defId:identifier,lane:natural,progress:nonnegative,pos:vec,hp:nonnegative,maxHp:nonnegative,
  shield:nonnegative,maxShield:nonnegative,statuses:list(appliedStatus,32),memory:dictionary(finite),
  bountyPaid:boolean,generation:number(0,3,true),paidLayers:distinct(natural,256),
});
const gameEvent=shape({
  id:natural,time:nonnegative,kind:eventKind,source:optional(identifier),target:optional(identifier),
  pos:optional(vec),to:optional(vec),amount:optional(nonnegative),element:optional(element),
  visual:optional(string(0,256)),layer:optional(natural),
  fromVisual:optional(string(0,256)),toVisual:optional(string(0,256)),
});
const projectile=shape({
  id:identifier,source:identifier,pos:vec,previous:vec,velocity:vec,target:(v,p)=>{if(v!==null)identifier(v,p);},
  remainingLife:nonnegative,remainingPierce:nonnegative,hitTargets:distinct(identifier,1800),
  attack,visual:string(0,256),
});
const strike=shape({
  id:identifier,source:identifier,pos:vec,direction:vec,remainingWindup:nonnegative,remainingActive:nonnegative,
  attack,hitTargets:distinct(identifier,1800),visual:string(0,256),
});
export const gameState=shape({
  version:literal(1),options:runOptions,phase,time:nonnegative,rules,
  tick:natural,rng:number(0,4294967295,true),nextEntity:natural,nextEvent:natural,credits:amount,lives:nonnegative,
  wave:natural,waveTime:nonnegative,spawnCursor:list(natural,8192),paused:boolean,
  speed:enumeration(1,2,3),autoStart:boolean,
  towers:list(tower,5000),enemies:list(enemy,1800),events:list(gameEvent,8192),
  projectiles:list(projectile,8192),strikes:list(strike,8192),
  stats:shape({spent:amount,earned:amount,kills:natural,damage:nonnegative,leaks:natural,abilities:natural,cashSubunits:number(0,99,true)}),
});
const action:Record<string,Check>={
  place:shape({type:literal('place'),tower:identifier,pos:vec}),
  upgrade:shape({type:literal('upgrade'),tower:identifier,path:enumeration(0,1,2)}),
  sell:shape({type:literal('sell'),tower:identifier}),
  target:shape({type:literal('target'),tower:identifier,targeting}),
  ability:shape({type:literal('ability'),tower:identifier,ability:identifier}),
  startWave:shape({type:literal('startWave')}),
  pause:shape({type:literal('pause'),value:boolean}),
  speed:shape({type:literal('speed'),value:enumeration(1,2,3)}),
  autoStart:shape({type:literal('autoStart'),value:boolean}),
};
export function tagged(variants:Record<string,Check>):Check {
  return (v,p)=>{
    if(v===null||typeof v!=='object'||Array.isArray(v))throw new ProtocolError('INVALID_TYPE',p);
    const type=(v as Record<string,unknown>).type;
    if(typeof type!=='string'||!Object.hasOwn(variants,type))throw new ProtocolError('INVALID_ENUM',`${p}.type`);
    variants[type](v,p);
  };
}
const command=tagged(action);
const roomShape=shape({
  id:identifier,name:string(1,128),hostId:identifier,players:list(player,4,1),ready:distinct(identifier,4),
  started:boolean,options:runOptions,protocolVersion:literal(1),contentDigest:digest,
});
const room:Check=(v,p)=>{
  roomShape(v,p);
  const data=v as {hostId:string;players:{id:string}[];ready:string[]};
  const ids=data.players.map(player=>player.id);
  if(new Set(ids).size!==ids.length||!ids.includes(data.hostId)||data.ready.some(id=>!ids.includes(id)))
    throw new ProtocolError('OUT_OF_RANGE',`${p}.players`);
};
const result=shape({
  ok:boolean,reason:optional(string(0,512)),entity:optional(identifier),amount:optional(nonnegative),
  pending:optional(boolean),requestId:optional(identifier),
});
const runResult=shape({
  runId:identifier,mapId:identifier,modeId:identifier,won:boolean,wave:natural,rounds:natural,
  seed:number(-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,true),eligible:boolean,
  durationSeconds:nonnegative,contentDigest:digest,difficulty,
});
export const clientMessage=tagged({
  join:shape({type:literal('join'),protocolVersion:literal(1),contentDigest:digest,
    name:string(1,24),password:string(0,128),resumeToken:optional(string(1,256)),
    knowledge:optional(distinct(identifier,150))}),
  command:shape({type:literal('command'),seq:positiveSequence,command}),
  ready:shape({type:literal('ready'),value:boolean}),
  start:shape({type:literal('start')}),
  ping:shape({type:literal('ping'),at:nonnegative}),
});
export const serverMessage=tagged({
  welcome:shape({type:literal('welcome'),playerId:identifier,resumeToken:string(1,256),room}),
  room:shape({type:literal('room'),room}),
  snapshot:shape({type:literal('snapshot'),seq:natural,state:gameState,events:list(gameEvent,8192)}),
  result:shape({type:literal('result'),seq:positiveSequence,result}),
  runResult:shape({type:literal('runResult'),result:runResult}),
  error:shape({type:literal('error'),code:string(1,64),message:string(1,512)}),
  pong:shape({type:literal('pong'),at:nonnegative}),
});
