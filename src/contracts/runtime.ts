import type {GameState,GameConfig,GameEvent,EnemyState} from './index';
import {pointOnLane} from './geometry';
export function nextRandom(s:GameState):number {
 let x=s.rng|0;if(x===0)x=0x6d2b79f5;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;
 return s.rng/4294967296;
}
export function emit(s:GameState,event:Omit<GameEvent,'id'|'time'>):void {
 s.events.push({...event,id:s.nextEvent++,time:s.time});
}
export function credit(s:GameState,amount:number):number {
 if(!Number.isFinite(amount)||amount<0)throw new RangeError('Invalid credit amount');
 s.stats.cashSubunits+=Math.round(amount*100);
 const whole=Math.floor(s.stats.cashSubunits/100);s.stats.cashSubunits-=whole*100;
 s.credits+=whole;s.stats.earned+=whole;if(whole>0)emit(s,{kind:'income',amount:whole});return whole;
}
export function spawnEnemy(s:GameState,c:GameConfig,defId:string,lane:number,progress=0,hpMul=1,speedMul=1,generation=0):EnemyState {
 const def=c.enemies.find(e=>e.id===defId),map=c.maps.find(m=>m.id===s.options.mapId);
 if(!def||!map||!map.lanes[lane])throw new Error('Invalid enemy or lane');
 const enemy:EnemyState={id:'e'+s.nextEntity++,defId,lane,progress,pos:pointOnLane(map.lanes[lane],progress),hp:def.hp*hpMul,maxHp:def.hp*hpMul,shield:def.shield*hpMul,maxShield:def.shield*hpMul,statuses:[],memory:{speedMul},bountyPaid:false,generation,paidLayers:[]};
 s.enemies.push(enemy);emit(s,{kind:'spawn',target:enemy.id,pos:{...enemy.pos}});return enemy;
}
