import { createLobby, type LobbyContext } from '../../../src/ui/lobby';
import type { GameConfig, Profile, RoomState, RunOptions, LobbyUI } from '../../../src/contracts';
const config: GameConfig = {
  version:1,towers:[],enemies:[],waves:[],maps:[{id:'lantern-garden',name:'Сад фонарей',description:'',difficulty:1,campaignIndex:0,recommendedDifficulty:'easy',waveOverrides:{},lanes:[[{x:0,y:0},{x:100,y:100}]],pathWidth:20,blocked:[],water:[],theme:'garden',background:''}],
  modes:[{id:'standard',name:'Оборона маяка',description:'',modifiers:{},requiresClear:false}],campaign:[{id:'first',mapId:'lantern-garden',prerequisites:[],unlocks:[],title:'',briefing:'',outro:''}],contentVersion:'1',contentDigest:'fixture-digest',knowledge:[],economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,mapXP:[250,400,600,900],mapSeals:[80,120,180,260],modeReward:{standard:1},firstClearXP:1.5,repeatXP:.65,repeatSeals:.35,defeatXP:.35,respecCost:200},difficulties:[{id:'normal',name:'Обычная',rounds:60,lives:150,startCredits:900,towerCostMul:1,enemyHpMul:1,roundRewardBase:80,roundRewardStep:4,popCashMul:1,rewardMul:1}],knowledgeDiscount:0,startCredits:900,startLives:150,sellRatio:.7
};
const profile: Profile = {version:1,settings:{master:1,music:1,sfx:1,language:'ru',fullscreen:false,reducedMotion:false,quality:'high',colorblind:false},medals:{},unlockedCosmetics:[],bestWave:{},completedRuns:0,tutorialSeen:false,completedNodes:[],unlockedTowers:['needle','cannon','frost','beacon'],xp:0,level:1,seals:0,knowledgePoints:0,knowledgeUnlocked:[],knowledgePaid:[],claimedRuns:[],respecCount:0};
const players=[{id:'host',name:'Маячник',color:'#e7bc79',connected:true},{id:'guest',name:'Искра',color:'#8bd3ce',connected:true},{id:'g2',name:'Кремень',color:'#9ee7a6',connected:false}];
const options: RunOptions={mapId:'lantern-garden',difficulty:'normal',seed:13,endless:false,modeId:'standard',unlockedTowers:profile.unlockedTowers,players,runId:'fixture-run',knowledge:[]};
const base:RoomState={id:'room',name:'Северный маяк',hostId:'host',players,ready:['host'],started:false,options,protocolVersion:1,contentDigest:config.contentDigest};
const root=document.querySelector<HTMLElement>('#lobby')!; const output=document.querySelector<HTMLOutputElement>('#result')!;
let ui: LobbyUI, state:RoomState=structuredClone(base), ctx:LobbyContext={}, fail='', hold=false;
let calls: {kind:string;value?:unknown}[]=[];
function record(kind:string,value?:unknown){calls.push({kind,value});output.value=kind;}
function rebuild(language:'ru'|'en'='ru') {
  ui?.dispose(); calls=[]; output.value=''; state=structuredClone(base);ctx={};fail='';hold=false;
  ui=createLobby(root,config,{
    context:()=>ctx,
    host:async (opts,run)=>{record('host',{...opts,password:opts.password?'[set]':'',run}); if(fail) throw new Error(fail); if(hold) return new Promise<void>(()=>{}); ctx={playerId:'host',maxPlayers:opts.maxPlayers,addresses:['192.168.1.10','26.50.40.30'],port:opts.port};state={...state,options:run,players:[{...players[0],name:opts.name}],ready:[]};ui.update(state,'connected');},
    join:async (url,name,password)=>{record('join',{url,name,password:password?'[set]':''});if(fail)throw new Error(fail);if(hold)return new Promise<void>(()=>{});ctx={playerId:'guest',maxPlayers:4};state={...state,players:players.slice(0,2)};ui.update(state,'connected');},
    ready:value=>{record('ready',value);const id=ctx.playerId!;state={...state,ready:value?[...new Set([...state.ready,id])]:state.ready.filter(x=>x!==id)};ui.update(state,'connected');},
    start:()=>{record('start');state={...state,started:true};ui.update(state,'connected');},leave:()=>record('leave')
  });ui.show({...profile,settings:{...profile.settings,language}});
}
function showRoom(status='connected',host=true){ctx={playerId:host?'host':'guest',maxPlayers:4,addresses:['192.168.1.10','26.50.40.30'],port:43127};ui.update(state,status);}
const states:Record<string,()=>void>={create:()=>rebuild(),join:()=>{rebuild();root.querySelectorAll<HTMLButtonElement>('.pb-lobby__switches button')[1].click();},host:()=>{rebuild();showRoom();},guest:()=>{rebuild();showRoom('connected',false);},ready:()=>{rebuild();state={...state,players:players.slice(0,2),ready:['host','guest']};showRoom();},started:()=>{rebuild();state={...state,started:true};showRoom();ctx.credits=1125;ctx.lives=150;ui.update(state,'connected');},mismatch:()=>{rebuild();state={...state,contentDigest:'other'};showRoom();},reconnect:()=>{rebuild();showRoom('reconnecting',false);},expired:()=>{rebuild();showRoom('resume-expired',false);},offline:()=>{rebuild();showRoom('host offline',false);},english:()=>{rebuild('en');showRoom();},disposed:()=>{rebuild();ui.dispose();}};
for(const [name,fn] of Object.entries(states)){const b=document.createElement('button');b.textContent=name;b.type='button';b.onclick=fn;document.querySelector('#states')!.append(b);}
Object.assign(window,{fixture:{states,calls:()=>calls,fail:(s:string)=>fail=s,hold:()=>hold=true,dispose:()=>ui.dispose(),hide:()=>ui.hide(),showRoom,update:(s:string)=>ui.update(state,s)}});
rebuild();
