import type { AttackDef, GameConfig, GameState, TowerDef, TowerState, UpgradePath, VisualState } from '../../../src/contracts';

export const attack:AttackDef={mode:'shot',element:'kinetic',damage:10,interval:1,range:100,pierce:1,count:1,splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,statuses:[],projectileSpeed:300,projectileRadius:3,homing:false,windup:0,arc:0};
const visual=(asset:string):VisualState=>({asset,accent:'#ffc87a',muzzle:'shot',projectile:'shot',impact:'spark',scale:1,glow:0,motion:'none'});
export function makeDef(id='needle',category:TowerDef['category']='weapon'):TowerDef {
 const paths=[0,1,2].map(p=>{
  const letter='abc'[p];
  return {id:letter,name:'Путь '+letter.toUpperCase(),description:'Развитие',upgrades:[1,2,3,4,5].map(n=>({
   id:letter+n,name:'Улучшение '+letter+n,description:'Увеличивает урон',tier:n as 1|2|3|4|5,cost:100*n,delta:{damageMul:2},visual:visual(letter+n+'.svg'),
   ...(n===3?{replaceAttack:{...attack,damage:100*(p+1),mode:'beam' as const}}:{}),
   ...(n===4?{abilities:[{id:'burst',name:'Импульс',description:'Урон',cooldown:20,kind:'nova' as const,power:10,duration:1,radius:100,element:'energy' as const}]}:{})
  }))} satisfies UpgradePath;
 }) as TowerDef['paths'];
 return {id,name:'Башня '+id,category,description:'Защита маяка',cost:250,footprint:12,placement:'land',attack:{...attack,statuses:[]},effects:[],abilities:[],visual:visual('base.svg'),paths};
}
export function makeTower(defId='needle',id='t1'):TowerState {
 return {id,defId,owner:'p1',pos:{x:100,y:100},tiers:[0,0,0],targeting:'first',invested:251,cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0};
}
export function makeConfig():GameConfig {
 const ids='needle cannon rail scatter saw ember frost tesla venom prism mortar rocket drone mine resonator chrono gravity mirror portal storm beacon forge observatory mint bank orchard harbor tide coral bastion'.split(' ');
 const categories:TowerDef['category'][]=['weapon','element','tech','support','economy','water'];
 const towers=ids.map((id,i)=>makeDef(id,categories[Math.min(5,Math.floor(i/5))]));
 return {version:1,towers,enemies:[],waves:[{number:1,groups:[],reward:84,preview:'Алые осколки'}],maps:[],modes:[],campaign:[],contentVersion:'test',contentDigest:'fixture',knowledge:[],economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,mapXP:[250,400,600,900],mapSeals:[80,120,180,260],modeReward:{},firstClearXP:1.5,repeatXP:.65,repeatSeals:.35,defeatXP:.35,respecCost:200},difficulties:[],knowledgeDiscount:.08,startCredits:900,startLives:150,sellRatio:.7};
}
export function makeState():GameState {
 return {version:1,options:{mapId:'garden',difficulty:'normal',seed:1,endless:false,modeId:'standard',unlockedTowers:['needle','cannon','frost','beacon'],players:[{id:'p1',name:'Хост',color:'#dd9933',connected:true}],runId:'test',knowledge:[]},phase:'build',time:0,rules:{incomeMul:1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1.1,sellAllowed:true,maxLives:150,allowAbilities:true,allowPassiveIncome:true,maxTowers:60,maxTier:5,weather:'none',allowKnowledge:true,rounds:60,roundRewardBase:80,roundRewardStep:4,popCashMul:1},tick:0,rng:1,nextEntity:2,nextEvent:0,credits:900,lives:150,wave:0,waveTime:0,spawnCursor:[],paused:false,speed:1,autoStart:false,towers:[makeTower()],enemies:[],events:[],projectiles:[],strikes:[],stats:{spent:251,earned:0,kills:0,damage:0,leaks:0,abilities:0,cashSubunits:0}};
}
