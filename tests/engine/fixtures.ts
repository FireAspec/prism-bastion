import type {
 AttackDef,CombatModule,Difficulty,EffectDef,EnemyDef,GameConfig,MapDef,ModeDef,
 PlayerInfo,RunOptions,Tiers,TowerDef,UpgradeDef,VisualState,
} from '../../src/contracts';
import {credit,nextRandom} from '../../src/contracts/runtime';

const attack:AttackDef={
 mode:'shot',element:'kinetic',damage:1,interval:1,range:100,pierce:1,count:1,
 splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,shieldMultiplier:1,
 bossMultiplier:1,executeBelow:0,push:0,statuses:[],
 projectileSpeed:100,projectileRadius:2,homing:false,windup:0,arc:0,
};
const visual=(name:string):VisualState=>({
 asset:name,accent:'red',muzzle:'m',projectile:'p',impact:'i',scale:1,glow:0,motion:'none',
});
export const effect=(kind:EffectDef['kind'],power:number,cap=100,stat?:EffectDef['stat']):EffectDef=>({
 id:`${kind}-${power}`,kind,power,cap,stat,radius:500,interval:1,duration:1,
});
const upgrade=(path:number,tier:1|2|3|4|5):UpgradeDef=>({
 id:`p${path}-t${tier}`,name:'Upgrade',description:'test',tier,cost:10,
 delta:{damageMul:0.1},visual:visual(`p${path}-t${tier}`),
});
export function tower(id='needle',cost=100,placement:TowerDef['placement']='land'):TowerDef{
 return {id,name:'Test tower',description:'',category:'weapon',cost,footprint:12,
  placement,attack:structuredClone(attack),effects:[],abilities:[
   {id:'mint',name:'mint',description:'',cooldown:0,kind:'mint',power:5,duration:0,radius:0,element:'kinetic'},
   {id:'barrier',name:'barrier',description:'',cooldown:0,kind:'barrier',power:1,duration:0,radius:0,element:'kinetic'},
  ],visual:visual('base'),
  paths:[0,1,2].map(i=>({id:`p${i}`,name:'p',description:'',upgrades:[1,2,3,4,5].map(t=>
   upgrade(i,t as 1|2|3|4|5))})) as TowerDef['paths']};
}
export const enemy:EnemyDef={
 id:'orb',name:'orb',description:'',color:'red',shape:'orb',hp:2,speed:120,
 bounty:2,leak:2,radius:8,armor:0,shield:0,regen:0,cloaked:false,flying:false,
 resist:{},children:[],layers:[{hp:1,cash:1,color:'red'},{hp:1,cash:1,color:'blue'}],
};
export const map:MapDef={
 id:'test-map',name:'test',description:'',difficulty:1,campaignIndex:0,
 recommendedDifficulty:'normal',waveOverrides:{},
 lanes:[[{x:100,y:300},{x:300,y:300}],[{x:100,y:380},{x:100,y:480},{x:300,y:480}]],
 pathWidth:20,
 blocked:[[{x:450,y:200},{x:500,y:200},{x:500,y:250},{x:450,y:250}]],
 water:[[{x:600,y:100},{x:800,y:100},{x:800,y:270},{x:600,y:270}]],
 theme:'garden',background:'',
};
export function fixture():GameConfig {
 const modeIds=['standard','half-cash','no-leaks','iron-oath','short-supply','blackout','stormfront','overdrive','low-tech','no-actives'];
 const overrides:Record<string,ModeDef['modifiers']>={
  'iron-oath':{allowPassiveIncome:false,sellAllowed:false,allowKnowledge:false,maxLives:1},
  'no-leaks':{maxLives:1},'short-supply':{maxTowers:12},
  'low-tech':{maxTier:3},'no-actives':{allowAbilities:false},'overdrive':{enemySpeedMul:1.35,incomeMul:1.1},
 };
 return {
  version:1,towers:[tower(),tower('bank',100),tower('boat',100,'water')],
  enemies:[structuredClone(enemy)],
  waves:Array.from({length:100},(_,i)=>({number:i+1,groups:[{
   enemy:'orb',count:1,at:0,every:0,lane:i%2,
  }],reward:9999,preview:'test'})),
  maps:[structuredClone(map)],modes:modeIds.map(id=>({
   id,name:id,description:'',requiresClear:false,modifiers:overrides[id]??{},
  })),
  campaign:[],contentVersion:'1',contentDigest:'test',knowledge:[],
  economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,
   mapXP:[1,1,1,1],mapSeals:[1,1,1,1],modeReward:{},firstClearXP:0,repeatXP:0,
   repeatSeals:0,defeatXP:0,respecCost:0},
  difficulties:(['easy','normal','hard','extreme'] as Difficulty[]).map((id,i)=>({
   id,name:id,rounds:[40,60,80,100][i],lives:[200,150,100,1][i],
   startCredits:[1000,900,850,850][i],towerCostMul:[0.85,1,1.1,1.2][i],
   enemyHpMul:[0.85,1,1.1,1.2][i],roundRewardBase:[100,80,60,50][i],
   roundRewardStep:[5,4,3,2][i],popCashMul:1,rewardMul:1,
  })),
  knowledgeDiscount:0,startCredits:900,startLives:150,sellRatio:0.7,
  endlessWave:(n:number)=>({number:n,groups:[],reward:0,preview:'endless'}),
 };
}
export function players(n=1):PlayerInfo[]{
 return Array.from({length:n},(_,i)=>({id:`p${i}`,name:`player${i}`,color:'red',connected:true}));
}
export function options(change:Partial<RunOptions>={}):RunOptions {
 return {mapId:'test-map',difficulty:'normal',seed:123456,endless:false,modeId:'standard',
  unlockedTowers:['needle','bank','boat'],players:players(),runId:'test-run',knowledge:[],...change};
}
export function combat(kind:'idle'|'clear'|'random'|'layers'='idle'):CombatModule {
 return {
  resolveTower(def:TowerDef,tiers:Tiers){
   const additions=def.paths.flatMap((p,i)=>p.upgrades.slice(0,tiers[i]));
   return {attack:structuredClone(def.attack),effects:[
    ...structuredClone(def.effects),...additions.flatMap(u=>structuredClone(u.effects??[]))],
   abilities:[...structuredClone(def.abilities),...additions.flatMap(u=>structuredClone(u.abilities??[]))],
   visual:additions.at(-1)?.visual??def.visual};
  },
  step(s){
   if(kind==='random'){
    nextRandom(s);
    s.stats.damage+=nextRandom(s);
   }
   if(kind==='layers'){
    for(const e of s.enemies){
     for(const idx of [0,1]){
      if(!e.paidLayers.includes(idx)){
       credit(s,s.rules.incomeMul*s.rules.popCashMul);
       e.paidLayers.push(idx);
      }
     }
    }
   }
   if(kind==='clear'||kind==='layers'||kind==='random')s.enemies.length=0;
  },
  activate(s,c,towerId,abilityId){
   if(!c.towers.flatMap(t=>t.abilities).some(a=>a.id===abilityId))return {ok:false,reason:'not-available'};
   if(abilityId==='mint')credit(s,5*s.rules.incomeMul);
   if(abilityId==='barrier')s.lives++;
   return {ok:true,entity:towerId};
  },
 };
}
