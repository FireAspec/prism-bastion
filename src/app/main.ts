import './runtime.css';
import { loadContent, validateContent } from '../content';
import { createCampaign } from '../campaign';
import { createProgression } from '../progression';
import { createSaveStore } from '../persistence';
import { createCombat } from '../combat';
import { createGame, restoreGame } from '../engine';
import { createRenderer } from '../render';
import { createHUD } from '../ui/hud';
import { createMenus } from '../ui/menus';
import { createLobby } from '../ui/lobby';
import { createKnowledgeUI } from '../ui/knowledge';
import { createAudio } from '../audio';
import { createLocale } from '../localization';
import { createCoopClient } from '../network/client';
import type { GameConfig, GameRenderer, HUD, GameCommand, RunOptions, Settings, MenuUI, LobbyUI, KnowledgeUI, AudioSystem, HostOptions, Vec, CommandResult, GameState } from '../contracts';
import { PROTOCOL_VERSION } from '../contracts';
import { Session, placementValid, nextPriority, type Frame } from './session';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app');
const canvas = document.createElement('canvas'); canvas.id='game-canvas'; canvas.tabIndex=0; canvas.setAttribute('aria-label','Игровое поле');
function layer(id: string): HTMLElement { const element=document.createElement('div');element.id=id;return element; }
const hudRoot=layer('hud'), menuRoot=layer('menus'), lobbyRoot=layer('lobby'), knowledgeRoot=layer('knowledge'), status=layer('runtime-status'), controls=layer('runtime-controls');
status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
root.replaceChildren(canvas,hudRoot,menuRoot,lobbyRoot,knowledgeRoot,controls,status);
const show=(el: HTMLElement,value: boolean)=>{el.hidden=!value;};
const message=(value: string)=>{status.textContent=value;show(status,!!value);};
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
function fatal(e:unknown): void { message(`Ошибка запуска / Startup error: ${errorText(e)}`);const b=document.createElement('button');b.textContent='Повторить / Retry';b.onclick=()=>location.reload();status.append(b); }

function bootstrap(): ()=>void {
  const catalog=loadContent(); const failures=validateContent(catalog);if(failures.length)throw new Error(failures.join('\n'));
  const campaign=createCampaign(catalog.campaign), progression=createProgression(catalog), store=createSaveStore(localStorage);
  // Keep the last host checkpoint separate from a resumable solo run.
  const hostPrefix='prism-bastion.host.';
  const hostStorage:Storage={get length(){return Object.keys(localStorage).filter(k=>k.startsWith(hostPrefix)).length;},key:i=>Object.keys(localStorage).filter(k=>k.startsWith(hostPrefix))[i]?.slice(hostPrefix.length)??null,getItem:k=>localStorage.getItem(hostPrefix+k),setItem:(k,v)=>localStorage.setItem(hostPrefix+k,v),removeItem:k=>localStorage.removeItem(hostPrefix+k),clear:()=>{for(const k of Object.keys(localStorage))if(k.startsWith(hostPrefix))localStorage.removeItem(k);}};
  const hostStore=createSaveStore(hostStorage);
  const session=new Session({config:catalog,campaign,progression,store,createCombat,createGame,restoreGame,id:()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint32Array(4)),v=>v.toString(16).padStart(8,'0')).join('-')});
  const locale=createLocale(session.profile.settings.language);
  let renderer:GameRenderer|null=null, hud:HUD|null=null, menus:MenuUI|null=null, lobby:LobbyUI|null=null, knowledge:KnowledgeUI|null=null, audio:AudioSystem|null=null;
  let selected:string|null=null, placing:string|null=null, pointer:Vec|null=null, activeRun='', lastFrame:number|null=null, raf=0, generation=0, stopped=false, hostRunning=false, scene='', autosave=0, visibilityPaused=false, assetReady=false, networkBusy=false;
  let assetAbort:AbortController|null=null; const listeners=new AbortController(); const signal=listeners.signal;
  let screen:'title'|'maps'|'settings'|'help'|'victory'|'defeat'|'game'|'lobby'|'knowledge'='title';
  let previousScreen:'title'|'maps'='title';
  const tr=(ru:string,en:string)=>session.profile.settings.language==='ru'?ru:en;
  const report=(e:unknown)=>{const text=errorText(e);if(status.textContent===text&&!status.hidden)return;message(text);try{hud?.notify(text);}catch(err){console.error(err);}};
  const guard=(action:()=>void)=>{try{action();}catch(e){report(e);}};
  const safe=(action:()=>void)=>{try{action();}catch(e){console.error(e);}};
  function button(text:string, action:()=>void): HTMLButtonElement { const el=document.createElement('button');el.type='button';el.textContent=text;el.addEventListener('click',()=>guard(action),{signal});return el; }
  const back=button(tr('Назад','Back'),()=>{void leave().catch(report);});
  const save=button(tr('Сохранить','Save'),()=>{session.checkpoint();message(tr('Сохранено','Saved'));});
  const priority=button(tr('Приоритет','Priority'),()=>changePriority());
  const continueRun=button(tr('Продолжить endless','Continue endless'),()=>{setScreen('game');message('');});
  const restart=button(tr('Перезапуск','Restart'),()=>{if(session.kind==='solo'&&session.state&&window.confirm(tr('Начать этот забег заново?','Restart this run?')))start(session.state.options);});
  controls.append(back,save,priority,restart,continueRun);
  function setScreen(next:typeof screen):void {
    screen=next;show(canvas,next==='game'||next==='victory'||next==='defeat');show(hudRoot,next==='game');show(menuRoot,['title','maps','settings','help','victory','defeat'].includes(next));show(lobbyRoot,next==='lobby');show(knowledgeRoot,next==='knowledge');show(controls,next==='game'||next==='lobby'||next==='knowledge'||next==='victory'||next==='defeat');show(continueRun,next==='victory'&&!!session.state?.options.endless); show(save,next==='game'&&session.kind==='solo');show(priority,next==='game');show(restart,(next==='game'||next==='victory'||next==='defeat')&&session.kind==='solo');
    if(next!=='lobby')lobby?.hide();if(next!=='knowledge')knowledge?.hide();if(next==='game'||next==='lobby'||next==='knowledge')menus?.hide();
  }
  function menu(next:'title'|'maps'|'settings'|'help'|'victory'|'defeat'):void { setScreen(next);menus?.show(next,session.profile,session.saved); }
  function disposeRun():void {
    generation++;assetAbort?.abort();assetAbort=null;assetReady=false;activeRun='';selected=null;placing=null;pointer=null;visibilityPaused=false;autosave=0;
    const oldHud=hud,oldRenderer=renderer;hud=null;renderer=null;safe(()=>oldHud?.dispose());safe(()=>oldRenderer?.dispose());hudRoot.replaceChildren();
  }
  function checkpointHost():void{if(session.kind==='host'&&session.state)hostStore.save({version:1,savedAt:new Date().toISOString(),contentVersion:catalog.contentVersion,profile:session.profile,run:{...session.state,events:[]}});}
  async function stopHost():Promise<void>{if(hostRunning){await window.prismDesktop?.stopHost();hostRunning=false;}}
  async function leave():Promise<void>{
    if(networkBusy)throw new Error(tr('Подключение ещё выполняется','Connection in progress'));
    if(screen==='knowledge'){menu(previousScreen);return;}
    if(session.kind==='solo')session.checkpoint();
    checkpointHost();await stopHost();session.close();disposeRun();menu('title');message('');
  }
  function choose(id:string|null):void{if(id&&!session.state?.options.unlockedTowers.includes(id))return;placing=id;selected=null;pointer=null;}
  function select(id:string|null):void{selected=id;placing=null;pointer=null;}
  function dispatch(command:GameCommand):CommandResult{
    try{const result=session.command(command);if(!result.ok)report(result.reason??tr('Команда отклонена','Command rejected'));return result;}
    catch(e){report(e);return {ok:false,reason:errorText(e)};}
  }
  function changePriority():void{const tower=session.state?.towers.find(t=>t.id===selected);if(tower)dispatch({type:'target',tower:tower.id,targeting:nextPriority(tower.targeting)});}
  function assetUrl(path:string):string {
    if(/^[a-z][a-z0-9+.-]*:|^\/\/|(?:^|\/)\.\.(?:\/|$)/i.test(path))throw new Error('Invalid asset path: '+path);
    const clean=path.replace(/^\/?public\//,'').replace(/^\//,'');
    const url=new URL(clean,document.baseURI);if(url.origin!==location.origin&&location.protocol!=='file:')throw new Error('External asset: '+path);return url.href;
  }
  function loadImage(path:string,abort:AbortSignal):Promise<void>{return new Promise((resolve,reject)=>{
    if(abort.aborted){reject(new Error('Cancelled'));return;}
    const image=new Image();let done=false;
    const finish=(e?:Error)=>{if(done)return;done=true;clearTimeout(timer);abort.removeEventListener('abort',cancel);image.onload=null;image.onerror=null;if(e)reject(e);else resolve();};
    const cancel=()=>{finish(new Error('Cancelled'));image.src='';};
    const timer=window.setTimeout(()=>finish(new Error('Asset timeout: '+path)),12000);
    abort.addEventListener('abort',cancel,{once:true});image.onload=()=>finish();image.onerror=()=>finish(new Error('Asset unavailable: '+path));
    try{image.src=assetUrl(path);}catch(e){finish(new Error(errorText(e)));}
  });}
  async function mountRun(state:GameState):Promise<void>{
    if(activeRun===state.options.runId)return;disposeRun();activeRun=state.options.runId;const token=generation;
    const config=session.config;setScreen('game');message(tr('Загрузка ресурсов…','Loading assets…'));
    try{
      renderer=createRenderer(canvas,config);
      hud=createHUD(hudRoot,config,{command:dispatch,chooseTower:choose,select,exit:()=>{void leave().catch(report);},playerId:session.playerId,isHost:session.kind!=='client'},locale);
      renderer.resize();
      const map=config.maps.find(m=>m.id===state.options.mapId);if(!map)throw new Error('Missing map');
      assetAbort=new AbortController();const abort=assetAbort.signal;
      const assets=[map.background,...config.towers.filter(t=>state.options.unlockedTowers.includes(t.id)).map(t=>t.visual.asset.includes('/')?t.visual.asset:`art/towers/${t.id}/${t.visual.asset}`)].filter(Boolean);
      const results=await Promise.allSettled([...new Set(assets)].map(a=>loadImage(a,abort)));
      if(stopped||token!==generation)return;
      const missing=results.filter(r=>r.status==='rejected');assetReady=true;
      message(missing.length?tr(`Не загружено ресурсов: ${missing.length}`,`Missing assets: ${missing.length}`):'');
    }catch(e){if(token===generation){disposeRun();report(e);if(session.kind==='solo'){safe(()=>session.checkpoint());session.close();menu('title');}else{void leave().catch(report);}}}
  }
  function start(options:RunOptions):void { if(networkBusy||session.kind==='host'||session.kind==='client')throw new Error('Close multiplayer first');session.start(options);disposeRun();void mountRun(session.state!); }
  function resume():void {if(networkBusy||session.kind==='host'||session.kind==='client')throw new Error('Close multiplayer first');session.resume();disposeRun();void mountRun(session.state!);}
  function applySettings(value:Settings):void {
    session.changeProfile({...session.profile,settings:{...value}});locale.setLanguage(value.language);document.documentElement.lang=value.language;audio?.setSettings(value);
    restart.textContent=tr('Перезапуск','Restart');continueRun.textContent=tr('Продолжить endless','Continue endless');back.textContent=tr('Назад','Back');save.textContent=tr('Сохранить','Save');priority.textContent=tr('Приоритет','Priority');
    if(window.prismDesktop)void window.prismDesktop.setFullscreen(value.fullscreen).catch(report);
    else if(value.fullscreen&&!document.fullscreenElement)void document.documentElement.requestFullscreen().catch(report);
    else if(!value.fullscreen&&document.fullscreenElement)void document.exitFullscreen().catch(report);
  }
  function openKnowledge():void {previousScreen=screen==='maps'?'maps':'title';setScreen('knowledge');knowledge?.show(session.profile);}
  async function openLobby():Promise<void> {if(session.kind!=='idle')await leave();setScreen('lobby');lobby?.show(session.profile);}
  async function connect(url:string,name:string,password:string,kind:'host'|'client'):Promise<void>{
    const client=createCoopClient();session.attach(client,kind);
    await client.connect(url,{type:'join',protocolVersion:PROTOCOL_VERSION,contentDigest:catalog.contentDigest,name,password,knowledge:[...session.profile.knowledgeUnlocked]});
  }
  async function host(options:HostOptions,request:RunOptions):Promise<void>{
    if(networkBusy||hostRunning||session.kind!=='idle')throw new Error('Room already open');
    const bridge=window.prismDesktop;if(!bridge)throw new Error(tr('Создание комнаты доступно в настольной версии','Hosting requires desktop app'));
    const run=session.prepare(request);networkBusy=true;
    try{const info=await bridge.startHost(options,run);hostRunning=true;if(stopped){await stopHost();return;}
      await connect(`ws://127.0.0.1:${info.port}`,options.name,options.password,'host');
    }catch(e){session.close();await stopHost();report(e);throw e;}finally{networkBusy=false;}
  }
  async function join(url:string,name:string,password:string):Promise<void>{
    if(networkBusy||session.kind!=='idle')throw new Error('Room already open');networkBusy=true;
    try{const normalized=new URL(url.includes('://')?url:`ws://${url}`);if(!['ws:','wss:'].includes(normalized.protocol)||normalized.username||normalized.password)throw new Error('Invalid room address');await connect(normalized.href,name,password,'client');}
    catch(e){session.close();report(e);throw e;}finally{networkBusy=false;}
  }
  function importProfile(json:string):CommandResult{try{if(session.kind!=='idle')throw new Error('Close active run first');const data=store.import(json);session.profile=data.profile;session.saved=data.run;applySettings(data.profile.settings);menu('title');return {ok:true};}catch(e){report(e);return {ok:false,reason:errorText(e)};}}
  function editKnowledge(id?:string):void{const result=id===undefined?progression.respec(session.profile):progression.buy(session.profile,id);if(!result.ok){report(result.reason??'Недоступно');return;}session.changeProfile(result.profile);knowledge?.update(session.profile);}
  function playFrame(frame:Frame):void {
    const s=frame.state;if(!renderer||!hud)return;
    if(selected&&!s.towers.some(t=>t.id===selected))selected=null;
    const preferences=session.profile.settings;
    const errors:unknown[]=[];
    for(const consume of [()=>renderer!.render(s,{selected:selected??undefined,placement:placing&&pointer?{tower:placing,pos:pointer,valid:placementValid(s,session.config,placing,pointer)}:undefined,preferences},frame.events,frame.seconds),()=>audio?.consume(frame.events),()=>hud!.update(s,selected,placing)]){try{consume();}catch(e){errors.push(e);}}
    if(errors.length)report(errors.map(errorText).join('\n'));
  }
  function updateScene():void {const s=session.state;const next=screen==='victory'||screen==='defeat'?'end':screen!=='game'||!s?'menu':s.enemies.some(e=>session.config.enemies.find(d=>d.id===e.defId)?.boss)?'boss':s.phase==='wave'?'wave':'build';if(scene!==next){audio?.setScene(next);scene=next;}}
  function loop(now:number):void {
    if(stopped)return;raf=requestAnimationFrame(loop);const dt=lastFrame===null?0:Math.max(0,Math.min((now-lastFrame)/1000,0.25));lastFrame=now;
    try{
      if(session.state&&activeRun!==session.state.options.runId)void mountRun(session.state);
      const frame=session.frame(session.kind==='solo'&&(!assetReady||document.hidden||screen!=='game')?0:dt);
      if(frame){playFrame(frame);const finished=session.finish();if(finished){const next=finished.result.won?'victory':'defeat';setScreen(next);menus?.show(next,session.profile,frame.state,finished.receipt);}
        if((session.kind==='solo'||session.kind==='host')&&screen==='game'){autosave+=dt;if(autosave>=10){if(session.kind==='solo')session.checkpoint();else checkpointHost();autosave=0;}}
      }
      updateScene();
    }catch(e){report(e);if(session.kind==='solo')safe(()=>{session.command({type:'pause',value:true});session.checkpoint();});}
  }
  function handlePointer(event:PointerEvent):void {
    if(screen!=='game'||!renderer||!session.state||!assetReady||event.button!==0||!event.isPrimary)return;
    const pos=renderer.screenToWorld(event.clientX,event.clientY);if(placing){const result=dispatch({type:'place',tower:placing,pos});if(result.ok&&!result.pending){selected=result.entity??null;placing=null;pointer=null;}else if(result.pending){placing=null;pointer=null;}return;}
    const tower=[...session.state.towers].reverse().find(t=>Math.hypot(t.pos.x-pos.x,t.pos.y-pos.y)<=(session.config.towers.find(d=>d.id===t.defId)?.footprint??0));select(tower?.id??null);
  }
  function key(event:KeyboardEvent):void{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;const target=event.target;if(target instanceof HTMLElement&&(target.matches('input,textarea,select,button')||target.isContentEditable))return;
    if(screen!=='game'||!session.state)return;const s=session.state;const k=event.key.toLowerCase();
    if(k==='escape'){if(placing||selected)select(null);else if(session.kind!=='client')dispatch({type:'pause',value:!s.paused});}
    else if(k===' '){dispatch({type:'startWave'});}else if(k==='p'){dispatch({type:'pause',value:!s.paused});}else if(k==='t'){changePriority();}else if(k==='s'){if(session.kind==='solo')session.checkpoint();}else if(k==='delete'&&selected){dispatch({type:'sell',tower:selected});}else if(k==='1'||k==='2'||k==='3'){dispatch({type:'speed',value:Number(k) as 1|2|3});}else return;event.preventDefault();
  }
  function dispose():void{if(stopped)return;stopped=true;cancelAnimationFrame(raf);listeners.abort();safe(()=>{if(session.kind==='solo')session.checkpoint();else checkpointHost();});safe(()=>session.close());disposeRun();safe(()=>menus?.dispose());safe(()=>lobby?.dispose());safe(()=>knowledge?.dispose());safe(()=>audio?.dispose());void stopHost().catch(console.error);}
  try{
    audio=createAudio(session.profile.settings);
    menus=createMenus(menuRoot,catalog,{start:o=>start(o),resume,settings:applySettings,knowledge:()=>guard(openKnowledge),coop:()=>{void openLobby().catch(report);},exportProfile:()=>store.export(),importProfile},locale);
    lobby=createLobby(lobbyRoot,catalog,{host,join,ready:v=>guard(()=>session.sendReady(v)),start:()=>guard(()=>session.sendStart()),leave:()=>{void leave().catch(report);}},locale);
    knowledge=createKnowledgeUI(knowledgeRoot,catalog,{buy:id=>guard(()=>editKnowledge(id)),respec:()=>guard(()=>editKnowledge()),close:()=>menu(previousScreen)},locale);
    session.onRoom=room=>lobby?.update(room,room.started?tr('Игра началась','Game started'):tr('Ожидание','Waiting'));
    session.onConnection=(phase,detail)=>{if(phase==='reconnecting'||phase==='failed'){const text=phase==='reconnecting'?tr('Восстановление подключения…','Reconnecting…'):tr('Подключение потеряно','Connection lost');message(detail?text+' — '+detail:text);if(session.room&&screen==='lobby')lobby?.update(session.room,text);}else if(phase==='connected'){message('');if(session.room&&screen==='lobby')lobby?.update(session.room,tr('Подключено','Connected'));}};
    session.onResult=result=>{if(!result.ok)report(result.reason??'Command rejected');else if(result.entity)selected=result.entity;};session.onError=report;
    canvas.addEventListener('pointerdown',handlePointer,{signal});canvas.addEventListener('pointermove',e=>{if(renderer&&placing)pointer=renderer.screenToWorld(e.clientX,e.clientY);},{signal});canvas.addEventListener('pointerleave',()=>{pointer=null;},{signal});canvas.addEventListener('contextmenu',e=>{e.preventDefault();select(null);},{signal});
    window.addEventListener('keydown',key,{signal});window.addEventListener('resize',()=>renderer?.resize(),{signal});
    document.addEventListener('visibilitychange',()=>guard(()=>{lastFrame=null;if(session.kind!=='solo'||!session.state)return;if(document.hidden){visibilityPaused=!session.state.paused;if(visibilityPaused)dispatch({type:'pause',value:true});session.checkpoint();}else if(visibilityPaused){visibilityPaused=false;dispatch({type:'pause',value:false});}}),{signal});
    window.addEventListener('pagehide',()=>dispose(),{signal});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
    let unlocked=false;const unlock=()=>{if(unlocked)return;unlocked=true;void audio?.unlock().catch(e=>{unlocked=false;report(e);});};window.addEventListener('pointerdown',unlock,{signal});window.addEventListener('keydown',unlock,{signal});
    document.documentElement.lang=session.profile.settings.language;menu('title');message('');raf=requestAnimationFrame(loop);return dispose;
  }catch(e){dispose();throw e;}
}
try { bootstrap(); } catch(e) { fatal(e); }
