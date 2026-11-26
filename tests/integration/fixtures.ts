import type {AttackDef, EnemyDef, GameConfig, Profile, RunOptions, TowerDef, VisualState, Tiers, PathIndex, KnowledgeStat} from '../../src/contracts';

export const seed = 710031;
export const towerIds = 'needle cannon rail scatter saw ember frost tesla venom prism mortar rocket drone mine resonator chrono gravity mirror portal storm beacon forge observatory mint bank orchard harbor tide coral bastion'.split(' ');
export const mapIds = 'lantern-garden copper-creek windmill-fields old-aqueduct orchard-wall freight-yard bell-foundry tidal-docks salt-marsh coral-gate clock-square fallen-observatory prism-quarry mirror-terrace glass-switchback fracture-bridge vault-district storm-coast black-lighthouse heart-of-storm'.split(' ');
export const unlocks = ['scatter ember','saw venom','rail tesla','mortar observatory','mint orchard','drone rocket','resonator forge','harbor','tide','coral','chrono','gravity','prism','mirror','mine','portal','bank','storm','bastion',''].map(x=>x.split(' ').filter(Boolean));
export const initial = ['needle','cannon','frost','beacon'];
export const paths: PathIndex[] = [0,1,2];
export const legal = new Set<string>(['0,0,0']);
for (const p of paths) for (let t=1;t<=5;t++) {
 const a=[0,0,0]; a[p]=t; legal.add(a.join(','));
}
// Explicit allowed two-path pairs, rather than calling production legality.
const pairs = ['1,1','1,2','1,3','1,4','1,5','2,1','2,2','2,3','2,4','2,5','3,1','3,2','4,1','4,2','5,1','5,2'];
for(const [p,q] of [[0,1],[0,2],[1,2]]) for(const pair of pairs){
 const a=[0,0,0]; [a[p],a[q]]=pair.split(',').map(Number); legal.add(a.join(','));
}
export const tiers = [...legal].map(s=>s.split(',').map(Number) as Tiers);
export const caps: Record<KnowledgeStat,number> = {
 weaponDamage:.15,weaponSpeed:.12,weaponRange:.10,elementDamage:.15,statusDuration:.15,
 shieldDamage:.20,supportRadius:.12,abilityCooldown:.12,controlDuration:.10,startingCash:.10,
 passiveIncome:.15,purchaseDiscount:.08,lives:20,bossDamage:.12,revealRadius:.15,xpGain:.10,
 sealGain:.10,waterDamage:.15,waterRange:.10
};
export function profile():Profile {
 return {version:1,settings:{reducedMotion:false,quality:'high',colorblind:false,master:1,music:1,sfx:1,language:'ru',fullscreen:false},medals:{},unlockedCosmetics:[],bestWave:{},completedRuns:0,tutorialSeen:false,completedNodes:[],unlockedTowers:[...initial],xp:0,level:1,seals:0,knowledgePoints:0,knowledgeUnlocked:[],knowledgePaid:[],claimedRuns:[],respecCount:0};
}
export function attack():AttackDef {
 return {mode:'beam',element:'kinetic',damage:10,interval:1,range:300,pierce:1,count:1,splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,statuses:[],projectileSpeed:300,projectileRadius:3,homing:false,windup:.2,arc:90};
}
export function visual(asset='art/towers/needle/base.svg'):VisualState {
 return {asset,accent:'#ffffff',muzzle:'dot',projectile:'dot',impact:'dot',scale:1,glow:0,motion:'none'};
}
export function tower(id='needle'):TowerDef {
 return {id,name:id,description:id,category:'weapon',cost:100,footprint:12,placement:'land',attack:attack(),effects:[],abilities:[],visual:visual(),paths:paths.map(p=>({id:'abc'[p],name:'path'+p,description:'path'+p,upgrades:([1,2,3,4,5] as const).map(t=>({id:id+'-'+p+'-'+t,name:'tier'+t,description:'tier'+t,cost:50,tier:t,delta:{damageMul:2},visual:visual('art/towers/'+id+'/'+'abc'[p]+t+'.svg')}))})) as TowerDef['paths']};
}
export function enemy():EnemyDef {
 return {id:'fixture',name:'fixture',description:'fixture',color:'#ff0000',shape:'orb',hp:30,speed:20,bounty:3,leak:1,radius:8,armor:0,shield:0,regen:4,cloaked:false,flying:false,resist:{},children:[],layers:[{hp:10,cash:1,color:'#ff0000'},{hp:10,cash:1,color:'#ff8800'},{hp:10,cash:1,color:'#ffff00'}]};
}
export function fixture():GameConfig {
 return {version:1,contentVersion:'fixture',contentDigest:'fixture-v1',startCredits:900,startLives:150,sellRatio:.7,knowledgeDiscount:0,
 towers:[tower()],enemies:[enemy()],maps:[{id:'fixture',name:'fixture',description:'fixture',difficulty:1,campaignIndex:1,recommendedDifficulty:'normal',waveOverrides:{},lanes:[[{x:0,y:360},{x:1280,y:360}]],pathWidth:40,blocked:[],water:[[{x:0,y:500},{x:1280,y:500},{x:1280,y:720},{x:0,y:720}]],theme:'garden',background:'fixture.svg'}],
 waves:[{number:1,groups:[{enemy:'fixture',count:1,at:0,every:1,lane:0}],reward:84,preview:'fixture'}],
 modes:[{id:'standard',name:'standard',description:'standard',requiresClear:false,modifiers:{}},{id:'half-cash',name:'half-cash',description:'half-cash',requiresClear:true,modifiers:{incomeMul:.5,startingCashMul:.5}},{id:'iron-oath',name:'iron-oath',description:'iron-oath',requiresClear:true,modifiers:{maxLives:1,allowKnowledge:false,sellAllowed:false,allowPassiveIncome:false}}],
 campaign:[],knowledge:[],difficulties:[{id:'normal',name:'normal',rounds:1,lives:150,startCredits:900,towerCostMul:1,enemyHpMul:1,roundRewardBase:80,roundRewardStep:4,popCashMul:1,rewardMul:1}],
 economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,mapXP:[250,400,600,900],mapSeals:[80,120,180,260],modeReward:{standard:1,'iron-oath':2.25},firstClearXP:1.5,repeatXP:.65,repeatSeals:.35,defeatXP:.35,respecCost:200}};
}
export function options(config:GameConfig):RunOptions {
 return {mapId:config.maps[0].id,difficulty:'normal',seed,endless:false,modeId:'standard',unlockedTowers:config.towers.map(t=>t.id),players:[{id:'p1',name:'One',color:'#ffffff',connected:true}],runId:'qa-'+seed,knowledge:[]};
}
