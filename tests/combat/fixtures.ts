import type {AbilityDef,AttackDef,AttackMode,EffectDef,EnemyDef,GameConfig,GameState,StatusSpec,TowerDef,TowerState,UpgradeDef} from '../../src/contracts';
import {spawnEnemy} from '../../src/contracts/runtime';

export const attack=(mode:AttackMode='shot',changes:Partial<AttackDef>={}):AttackDef=>({
  mode,element:'kinetic',damage:30,interval:.12,range:300,pierce:1,count:1,splash:80,
  chains:2,chainRadius:120,detects:true,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,
  executeBelow:0,push:0,statuses:[],projectileSpeed:900,projectileRadius:8,homing:false,
  windup:0,arc:0,...changes
});

export const status=(kind:StatusSpec['kind'],power=1,duration=2,maxStacks=1):StatusSpec=>({kind,power,duration,maxStacks});
export const effect=(kind:EffectDef['kind'],changes:Partial<EffectDef>={}):EffectDef=>({
  id:kind,kind,power:1,radius:200,interval:.1,duration:1,cap:5,...changes
});
export const ability=(kind:AbilityDef['kind'],changes:Partial<AbilityDef>={}):AbilityDef=>({
  id:kind,name:kind,description:kind,kind,cooldown:2,power:60,duration:2,radius:200,element:'energy',...changes
});
const visual=(id:string)=>({asset:`${id}.svg`,accent:'#fff',muzzle:'x',projectile:'x',impact:'x',scale:1,glow:0,motion:'none' as const});
const upgrade=(path:number,tier:number):UpgradeDef=>({
  id:`${path}-${tier}`,name:'Upgrade',description:'',cost:10,tier:tier as 1|2|3|4|5,
  delta:{damageMul:1.1},visual:visual(`${path}-${tier}`),
  ...(tier===5?{replaceAttack:attack('beam',{damage:50+path})}:{}),
  ...(tier===1?{addStatuses:[status(['mark','burn','poison'][path] as StatusSpec['kind'])]}:{})
});

export const tower=(id='test',mode:AttackMode='shot',effects:EffectDef[]=[],abilities:AbilityDef[]=[],a=attack(mode)):TowerDef=>({
  id,name:id,description:id,category:'weapon',cost:100,footprint:20,placement:'land',
  attack:a,effects,abilities,visual:visual(id),paths:[0,1,2].map(i=>({
    id:`path-${i}`,name:'Path',description:'',upgrades:[1,2,3,4,5].map(tier=>upgrade(i,tier))
  })) as TowerDef['paths']
});

export const enemy=(id='foe',changes:Partial<EnemyDef>={}):EnemyDef=>({
  id,name:id,description:id,color:'#f44',shape:'orb',hp:100,speed:30,bounty:10,leak:1,radius:10,
  armor:0,shield:0,regen:0,cloaked:false,flying:false,resist:{},children:[],
  layers:[{hp:30,cash:2,color:'red'},{hp:30,cash:3,color:'blue'},{hp:40,cash:5,color:'green'}],
  ...changes
});

export const placed=(defId='test',id='t1',x=0,y=0):TowerState=>({
  id,defId,owner:'player',pos:{x,y},tiers:[0,0,0],targeting:'first',invested:100,
  cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0
});

export function fixture(towers:TowerDef[]=[tower()],enemies:EnemyDef[]=[enemy()],options:{modeId?:string;incomeMul?:number;popCashMul?:number;maxLives?:number;allowAbilities?:boolean;allowPassiveIncome?:boolean}={}){
  const config={version:1,towers,enemies,waves:[],maps:[{id:'map',lanes:[[{x:0,y:0},{x:1000,y:0}]],pathWidth:10,blocked:[],water:[],waveOverrides:{},name:'',description:'',difficulty:1,campaignIndex:1,recommendedDifficulty:'normal',theme:'garden',background:''}],
    modes:[],campaign:[],contentVersion:'1',contentDigest:'x',knowledge:[],economy:{} as GameConfig['economy'],difficulties:[],knowledgeDiscount:0,startCredits:0,startLives:150,sellRatio:.7} as GameConfig;
  const state={version:1,options:{mapId:'map',difficulty:'normal',seed:1,endless:false,modeId:options.modeId??'standard',unlockedTowers:[],players:[],runId:'test',knowledge:[]},
    phase:'wave',time:0,rules:{incomeMul:options.incomeMul??1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1,
      sellAllowed:true,maxLives:options.maxLives??150,allowAbilities:options.allowAbilities??true,allowPassiveIncome:options.allowPassiveIncome??true,
      maxTowers:60,maxTier:5,weather:'none',allowKnowledge:false,rounds:60,roundRewardBase:80,roundRewardStep:4,popCashMul:options.popCashMul??1},
    tick:0,rng:123,nextEntity:1,nextEvent:1,credits:0,lives:90,wave:1,waveTime:0,spawnCursor:[],paused:false,speed:1,
    autoStart:false,towers:[],enemies:[],events:[],projectiles:[],strikes:[],
    stats:{spent:0,earned:0,kills:0,damage:0,leaks:0,abilities:0,cashSubunits:0}
  } as GameState;
  const spawn=(id=enemies[0].id,progress=80,hpMul=1)=>spawnEnemy(state,config,id,0,progress,hpMul);
  return {config,state,spawn};
}
