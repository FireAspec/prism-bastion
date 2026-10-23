import type {ClientMessage,ServerMessage,GameState,AttackDef,GameEvent,RoomState} from '../../../src/contracts';

export const DIGEST='5db0176e8107d7e9a12725388e6abf9b378875045b8ef63a9abf148af40a559c';

export const attack:AttackDef={
  mode:'shot',element:'kinetic',damage:5,interval:1,range:160,pierce:1,count:1,
  splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,shieldMultiplier:1,
  bossMultiplier:1,executeBelow:0,push:0,statuses:[],projectileSpeed:360,
  projectileRadius:4,homing:false,windup:0.1,arc:0,
};

const options:GameState['options']={
  mapId:'lantern-garden',difficulty:'normal',seed:42,endless:false,modeId:'normal',
  unlockedTowers:['needle'],players:[{id:'host',name:'Хозяин',color:'#00aa99',connected:true}],
  runId:'run-1',knowledge:[],
};

export function gameState():GameState {
  return {
    version:1,options:structuredClone(options),phase:'wave',time:12.5,
    rules:{incomeMul:1,startingCashMul:1,enemyHpMul:1,enemySpeedMul:1,towerCostMul:1,
      sellAllowed:true,maxLives:150,allowAbilities:true,allowPassiveIncome:true,
      maxTowers:500,maxTier:5,weather:'none',allowKnowledge:true,rounds:25,
      roundRewardBase:100,roundRewardStep:10,popCashMul:1},
    tick:750,rng:314159,nextEntity:4,nextEvent:3,credits:750,lives:150,
    wave:1,waveTime:2.5,spawnCursor:[1],paused:false,speed:1,autoStart:false,
    towers:[{id:'t1',defId:'needle',owner:'host',pos:{x:100,y:100},tiers:[5,2,0],targeting:'first',
      invested:13500,cooldown:0.2,abilityCooldowns:{nova:0},memory:{lastTarget:2},
      damageDealt:250,kills:3,generated:0}],
    enemies:[{id:'e1',defId:'shard',lane:0,progress:120,pos:{x:150,y:50},
      hp:12,maxHp:20,shield:0,maxShield:0,statuses:[{kind:'slow',power:0.2,duration:2,
        source:'t1',remaining:1,stacks:1}],memory:{speedMul:1},bountyPaid:false,generation:0,paidLayers:[0]}],
    events:[{id:1,time:12.5,kind:'hit',source:'t1',target:'e1',pos:{x:150,y:50},amount:8}],
    projectiles:[{id:'p1',source:'t1',pos:{x:110,y:110},previous:{x:100,y:100},
      velocity:{x:200,y:20},target:'e1',remainingLife:1.5,remainingPierce:1,
      hitTargets:[],attack:{...attack},visual:'needle-shot'}],
    strikes:[{id:'s1',source:'t1',pos:{x:100,y:100},direction:{x:1,y:0},
      remainingWindup:0.1,remainingActive:0.25,attack:{...attack,mode:'melee',arc:90},
      hitTargets:[],visual:'needle-swing'}],
    stats:{spent:13500,earned:14250,kills:3,damage:250,leaks:0,abilities:0,cashSubunits:25},
  };
}

export const event:GameEvent={id:2,time:13,kind:'waveEnd'};
export function room():RoomState {
  return {
    id:'room-1',name:'Кристальная комната',hostId:'host',
    players:[{id:'host',name:'Хозяин',color:'#00aa99',connected:true}],
    ready:['host'],started:false,options:structuredClone(options),
    protocolVersion:1,contentDigest:DIGEST,
  };
}

export function clientFixtures():ClientMessage[] {
  return [
    {type:'join',protocolVersion:1,contentDigest:DIGEST,name:'Игрок 🎮',password:'',knowledge:['ballistics-1']},
    {type:'join',protocolVersion:1,contentDigest:DIGEST,name:'Игрок',password:'secret',resumeToken:'opaque-token'},
    {type:'command',seq:1,command:{type:'place',tower:'needle',pos:{x:100,y:120}}},
    {type:'command',seq:2,command:{type:'upgrade',tower:'t1',path:2}},
    {type:'command',seq:3,command:{type:'sell',tower:'t1'}},
    {type:'command',seq:4,command:{type:'target',tower:'t1',targeting:'strong'}},
    {type:'command',seq:5,command:{type:'ability',tower:'t1',ability:'nova'}},
    {type:'command',seq:6,command:{type:'startWave'}},
    {type:'command',seq:7,command:{type:'pause',value:true}},
    {type:'command',seq:8,command:{type:'speed',value:3}},
    {type:'command',seq:9,command:{type:'autoStart',value:false}},
    {type:'ready',value:true},{type:'ready',value:false},{type:'start'},
    {type:'ping',at:1000.25},
  ];
}

export function serverFixtures():ServerMessage[] {
  return [
    {type:'welcome',playerId:'guest',resumeToken:'random-token',room:room()},
    {type:'room',room:room()},
    {type:'snapshot',seq:100,state:gameState(),events:[event]},
    {type:'result',seq:3,result:{ok:true,entity:'t1',amount:300,requestId:'req-1'}},
    {type:'result',seq:4,result:{ok:false,reason:'Недостаточно кредитов',pending:false}},
    {type:'runResult',result:{runId:'run-1',mapId:'lantern-garden',modeId:'normal',won:true,
      wave:25,rounds:25,seed:42,eligible:true,durationSeconds:900,contentDigest:DIGEST,
      difficulty:'normal'}},
    {type:'error',code:'CONTENT_MISMATCH',message:'Данные игры не совпадают'},
    {type:'pong',at:1000.25},
  ];
}

export interface InvalidFixture {label:string;packet:unknown;code:string;}
export function invalidClientFixtures():InvalidFixture[] {
  const join=clientFixtures()[0];
  return [
    {label:'unknown variant',packet:{type:'leave'},code:'INVALID_ENUM'},
    {label:'unknown top-level control',packet:{type:'start',admin:true},code:'UNKNOWN_FIELD'},
    {label:'join name too long',packet:{...join,name:'а'.repeat(25)},code:'OUT_OF_RANGE'},
    {label:'bad digest',packet:{...join,contentDigest:'bad'},code:'OUT_OF_RANGE'},
    {label:'bad version',packet:{...join,protocolVersion:2},code:'INVALID_ENUM'},
    {label:'duplicate knowledge',packet:{...join,knowledge:['x','x']},code:'OUT_OF_RANGE'},
    {label:'actor spoof',packet:{type:'command',seq:1,command:{type:'sell',tower:'t1',actor:'host'}},code:'UNKNOWN_FIELD'},
    {label:'actor wrapper',packet:{type:'command',seq:1,actor:'host',command:{type:'startWave'}},code:'UNKNOWN_FIELD'},
    {label:'negative sequence',packet:{type:'command',seq:-1,command:{type:'startWave'}},code:'OUT_OF_RANGE'},
    {label:'fractional sequence',packet:{type:'command',seq:1.5,command:{type:'startWave'}},code:'OUT_OF_RANGE'},
    {label:'invalid path',packet:{type:'command',seq:1,command:{type:'upgrade',tower:'t1',path:3}},code:'INVALID_ENUM'},
    {label:'invalid targeting',packet:{type:'command',seq:1,command:{type:'target',tower:'t1',targeting:'boss'}},code:'INVALID_ENUM'},
    {label:'non finite position',packet:{type:'command',seq:1,command:{type:'place',tower:'needle',pos:{x:Infinity,y:0}}},code:'INVALID_NUMBER'},
    {label:'invalid boolean',packet:{type:'ready',value:'yes'},code:'INVALID_TYPE'},
    {label:'extra start field',packet:{type:'start',debug:true},code:'UNKNOWN_FIELD'},
    {label:'negative ping',packet:{type:'ping',at:-2},code:'OUT_OF_RANGE'},
  ];
}

export function invalidServerFixtures():InvalidFixture[] {
  const snap=serverFixtures()[2] as Extract<ServerMessage,{type:'snapshot'}>;
  const state=gameState();state.credits=-1;
  const invalidTiers=gameState();invalidTiers.towers[0].tiers=[3,3,0];
  const invalidAttack=gameState();invalidAttack.projectiles[0].attack.mode='invalid' as AttackDef['mode'];
  const invalidStatus=gameState();invalidStatus.enemies[0].statuses[0].kind='oops' as 'slow';
  const negativeStats=gameState();negativeStats.stats.earned=-1;
  const run=serverFixtures()[5] as Extract<ServerMessage,{type:'runResult'}>;
  return [
    {label:'welcome missing room',packet:{type:'welcome',playerId:'p',resumeToken:'token'},code:'MISSING_FIELD'},
    {label:'unknown room property',packet:{type:'room',room:{...room(),admin:true}},code:'UNKNOWN_FIELD'},
    {label:'negative credits',packet:{...snap,state},code:'OUT_OF_RANGE'},
    {label:'illegal 3-3-0 tiers',packet:{...snap,state:invalidTiers},code:'OUT_OF_RANGE'},
    {label:'unknown attack mode',packet:{...snap,state:invalidAttack},code:'INVALID_ENUM'},
    {label:'unknown status kind',packet:{...snap,state:invalidStatus},code:'INVALID_ENUM'},
    {label:'negative earned',packet:{...snap,state:negativeStats},code:'OUT_OF_RANGE'},
    {label:'unknown event',packet:{...snap,events:[{id:1,time:0,kind:'other'}]},code:'INVALID_ENUM'},
    {label:'invalid result number',packet:{type:'result',seq:1,result:{ok:true,amount:-1}},code:'OUT_OF_RANGE'},
    {label:'invalid runResult',packet:{type:'runResult',result:{...run.result,durationSeconds:-1}},code:'OUT_OF_RANGE'},
    {label:'unknown error control',packet:{type:'error',code:'INVALID',message:'Ошибка',execute:true},code:'UNKNOWN_FIELD'},
    {label:'bad pong',packet:{type:'pong',at:Infinity},code:'INVALID_NUMBER'},
  ];
}
