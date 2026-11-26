import type { GameConfig, GameState, GameEngine, CombatModule, GameCommand, CommandResult, GameEvent, RunOptions, RunResult, RewardReceipt, SaveStore, SaveEnvelope, Profile, ServerMessage, CoopClient, RoomState, Targeting, Vec } from '../contracts';
import type { CampaignService } from '../contracts/coop';
import type { ProgressionService } from '../contracts/progression';
import { WORLD } from '../contracts';
import { distance, distanceToSegment, pointInPolygon } from '../contracts/geometry';

export interface SessionDependencies {
  config: GameConfig; campaign: CampaignService; progression: ProgressionService; store: SaveStore;
  createCombat(): CombatModule;
  createGame(config: GameConfig, options: RunOptions, combat: CombatModule): GameEngine;
  restoreGame(config: GameConfig, state: GameState, combat: CombatModule): GameEngine;
  id(): string;
}
export type SessionKind = 'idle' | 'solo' | 'host' | 'client';
export interface Frame { state: GameState; events: GameEvent[]; seconds: number; }
export const clone = <T>(value: T): T => structuredClone(value);
// Config contains an optional function; structuredClone alone cannot copy it.
export function copyConfig(config: GameConfig): GameConfig {
  const { endlessWave, ...data } = config;
  return { ...clone(data), ...(endlessWave ? { endlessWave } : {}) };
}
export function fixedConfig(config: GameConfig): GameConfig {
  const freeze = (value: unknown): void => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  freeze(config); return config;
}
export function normalizeOptions(config: GameConfig, campaign: CampaignService, profile: Profile, requested: RunOptions, id: string): RunOptions {
  const mode = config.modes.find(m => m.id === requested.modeId);
  const node = config.campaign.find(n => n.mapId === requested.mapId);
  if (!node || !campaign.availableMaps(profile).includes(requested.mapId)) throw new Error('Карта ещё закрыта');
  if (!mode || (mode.requiresClear && !profile.completedNodes.includes(node.id))) throw new Error('Режим ещё закрыт');
  if (!config.difficulties.some(d => d.id === requested.difficulty)) throw new Error('Неизвестная сложность');
  if (!Number.isSafeInteger(requested.seed) || requested.seed < 0 || requested.seed > 0xffffffff) throw new Error('Некорректный seed');
  const unlockedTowers = campaign.availableTowers(profile).filter(t => config.towers.some(d => d.id === t));
  const knowledge = mode.modifiers.allowKnowledge === false || mode.id === 'iron-oath' ? [] : [...new Set(profile.knowledgeUnlocked)].filter(k => config.knowledge.some(n => n.id === k));
  return { mapId: requested.mapId, difficulty: requested.difficulty, modeId: requested.modeId, seed: requested.seed, endless: requested.endless, runId: id, unlockedTowers, knowledge, players: [{id:'solo',name:'Игрок',color:'#55d6bd',connected:true}] };
}
export function placementValid(state: GameState, config: GameConfig, id: string, pos: Vec): boolean {
  const tower = config.towers.find(t => t.id === id), map = config.maps.find(m => m.id === state.options.mapId);
  if (!tower || !map || !state.options.unlockedTowers.includes(id) || state.towers.length >= state.rules.maxTowers) return false;
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  const r = tower.footprint;
  if (pos.x < r || pos.y < r || pos.x > WORLD.width-r || pos.y > WORLD.height-r) return false;
  const edge = (poly: Vec[]) => poly.reduce((min, a, i) => Math.min(min,distanceToSegment(pos,a,poly[(i+1)%poly.length])), Infinity);
  const intersects = (poly: Vec[]) => pointInPolygon(pos,poly) || edge(poly) < r;
  if (map.blocked.some(intersects) || map.lanes.some(l => l.slice(1).some((p,i) => distanceToSegment(pos,l[i],p) < map.pathWidth/2+r))) return false;
  if (state.towers.some(t => distance(t.pos,pos) < r+(config.towers.find(d=>d.id===t.defId)?.footprint ?? 0))) return false;
  if (tower.placement === 'land' && map.water.some(intersects)) return false;
  if (tower.placement === 'water' && !map.water.some(p => pointInPolygon(pos,p) && edge(p)>=r)) return false;
  return state.phase === 'build' || state.phase === 'wave' || (state.phase === 'victory' && state.options.endless);
}
export function nextPriority(current: Targeting): Targeting {
  const order: Targeting[] = ['first','last','strong','near']; return order[(order.indexOf(current)+1)%order.length];
}

/** Owns one simulation OR a remote stream. No browser timers or DOM here. */
export class Session {
  kind: SessionKind = 'idle';
  profile: Profile;
  saved: GameState | null;
  config: GameConfig;
  state: GameState | null = null;
  room: RoomState | null = null;
  playerId = 'solo';
  resumeToken: string | undefined;
  private engine: GameEngine | null = null;
  private client: CoopClient | null = null;
  private unsubscribe: (()=>void) | null = null;
  private unsubscribeStatus: (()=>void) | null = null;
  private seq = 0;
  private remoteSeq = -1;
  private lastEvent = -1;
  private remoteEvents: GameEvent[] = [];
  private pending = new Map<number, string>();
  private result: RunResult | null = null;
  private receipt: RewardReceipt | null = null;
  private presented = false;
  private runKey = '';
  onRoom: (room: RoomState) => void = ()=>{};
  onResult: (result: CommandResult) => void = ()=>{};
  onError: (message: string) => void = ()=>{};
  onConnection: (phase:string,message?:string) => void = ()=>{};
  constructor(private readonly deps: SessionDependencies) {
    this.config = deps.config;
    const loaded = deps.store.load(); this.profile = loaded.profile; this.saved = loaded.run;
  }
  private configure(options: RunOptions): GameConfig {
    const mode = this.deps.config.modes.find(m=>m.id===options.modeId);
    if (!mode) throw new Error('Неизвестный режим');
    const knowledge = mode.modifiers.allowKnowledge===false || mode.id==='iron-oath' ? [] : options.knowledge;
    return fixedConfig(this.deps.progression.applyKnowledge(copyConfig(this.deps.config), [...knowledge], mode.id));
  }
  prepare(request: RunOptions): RunOptions { return normalizeOptions(this.deps.config,this.deps.campaign,this.profile,request,this.deps.id()); }
  start(request: RunOptions): void {
    const options = this.prepare(request), config = this.configure(options);
    const engine = this.deps.createGame(config, options, this.deps.createCombat());
    const state=engine.getSnapshot();
    this.persist(this.profile,{...state,events:[]});
    this.close(); this.kind='solo'; this.config=config; this.engine=engine; this.state=state; this.runKey=options.runId;
    this.playerId=options.players[0].id;
  }
  resume(): void {
    if (!this.saved) throw new Error('Нет сохранённого забега');
    const snapshot = clone(this.saved);
    if (snapshot.options.players.length !== 1) throw new Error('Кооперативный забег нельзя загрузить как одиночный');
    const mode=this.deps.config.modes.find(m=>m.id===snapshot.options.modeId);
    if(mode?.modifiers.allowKnowledge===false||mode?.id==='iron-oath')snapshot.options.knowledge=[];
    const config = this.configure(snapshot.options);
    const engine = this.deps.restoreGame(config,snapshot,this.deps.createCombat());
    this.close(); this.kind='solo'; this.config=config; this.engine=engine; this.state=engine.getSnapshot(); this.runKey=snapshot.options.runId;this.playerId=snapshot.options.players[0].id;
  }
  attach(client: CoopClient, kind: 'host'|'client'): void {
    this.close(); this.kind=kind; this.client=client;
    this.unsubscribe=client.subscribe(message=>{ if (this.client===client) { try { this.receive(message); } catch(e) { this.onError(String(e)); } } });
    // Optional transport status extension; the frozen CoopClient remains sufficient.
    const extended=client as CoopClient & {subscribeStatus?:(listener:(status:{phase:string;message?:string})=>void)=>()=>void};
    this.unsubscribeStatus=extended.subscribeStatus?.(status=>{if(this.client===client){if(status.phase==='failed')this.pending.clear();this.onConnection(status.phase,status.message);}})??null;
  }
  sendReady(value: boolean): void { this.client?.send({type:'ready',value}); }
  sendStart(): void { this.client?.send({type:'start'}); }
  private receive(message: ServerMessage): void {
    switch(message.type) {
      case 'welcome': this.playerId=message.playerId; this.resumeToken=message.resumeToken; this.room=message.room; this.onRoom(message.room); break;
      case 'room': this.room=message.room; this.onRoom(message.room); break;
      case 'snapshot': {
        if (message.seq<=this.remoteSeq) return;
        const s=message.state;
        if (this.runKey!==s.options.runId) {
          this.config=this.configure(s.options); this.runKey=s.options.runId; this.lastEvent=-1; this.remoteEvents=[]; if(this.result?.runId!==s.options.runId)this.result=null; this.receipt=null; this.presented=false;
        }
        this.remoteSeq=message.seq; this.state=s;
        for(const e of message.events) if(e.id>this.lastEvent){this.remoteEvents.push(e);this.lastEvent=e.id;}
        // A hidden renderer must not retain an unbounded animation history.
        if(this.remoteEvents.length>8192) this.remoteEvents.splice(0,this.remoteEvents.length-8192);
        break;
      }
      case 'result': { const requestId=this.pending.get(message.seq); if(requestId===undefined)return; this.pending.delete(message.seq); this.onResult({...message.result,requestId,pending:false}); break; }
      case 'runResult': if(message.result.runId===(this.runKey || this.room?.options.runId) && !this.result && !this.presented) this.result=message.result; break;
      case 'error': this.onError(message.message); break;
      case 'pong': break;
    }
  }
  command(command: GameCommand): CommandResult {
    if(this.engine) return this.engine.dispatch({...command,actor:this.playerId});
    if(!this.client || !this.state) return {ok:false,reason:'Нет активного забега'};
    if(this.pending.size>=128) return {ok:false,reason:'Слишком много ожидающих команд'};
    const {actor: _actor,requestId: _requestId,...action}=command;
    const seq=++this.seq, requestId=command.requestId ?? `net-${seq}`;
    this.pending.set(seq,requestId);
    try { this.client.send({type:'command',seq,command:action}); }
    catch(e){this.pending.delete(seq);return {ok:false,reason:String(e),requestId};}
    return {ok:true,pending:true,requestId};
  }
  frame(seconds: number): Frame | null {
    if(this.engine){
      if(seconds>0)this.engine.step(Math.min(seconds,0.25));
      const events=this.engine.drainEvents(); this.state=this.engine.getSnapshot();
      const s=this.state;
      if(!this.presented && !this.result && (events.some(e=>e.kind==='victory') || s.phase==='victory' || s.phase==='defeat')) {
        this.result={runId:s.options.runId,mapId:s.options.mapId,modeId:s.options.modeId,difficulty:s.options.difficulty,won:s.phase==='victory'||events.some(e=>e.kind==='victory'),wave:s.wave,rounds:s.rules.rounds,seed:s.options.seed,eligible:true,durationSeconds:s.time,contentDigest:this.deps.config.contentDigest};
      }
      return {state:s,events,seconds};
    }
    if(!this.state)return null;
    const events=this.remoteEvents;this.remoteEvents=[];return {state:this.state,events,seconds};
  }
  private persist(profile: Profile, run: GameState|null): void {
    const envelope: SaveEnvelope={version:1,savedAt:new Date().toISOString(),contentVersion:this.deps.config.contentVersion,profile,run};
    this.deps.store.save(envelope); this.profile=profile;this.saved=run;
  }
  checkpoint(): void {
    const run=this.engine ? this.engine.getSnapshot() : this.saved;
    if(run && this.engine) run.events=[];
    this.persist(this.profile,run);
  }
  changeProfile(profile: Profile): void { this.persist(profile,this.saved); }
  /** Commit profile and checkpoint in the same save before showing a receipt. */
  finish(): {result:RunResult;receipt:RewardReceipt}|null {
    const result=this.result;
    if(!result||this.presented||!this.state)return null;
    if(!this.engine && (this.state.wave<result.wave || (this.state.phase!=='victory' && this.state.phase!=='defeat' && !this.state.options.endless)))return null;
    if(result.contentDigest!==this.deps.config.contentDigest) throw new Error('Версия результата не совпадает');
    const already=this.profile.claimedRuns.includes(result.runId);
    const outcome=already ? {profile:this.profile,receipt:{xp:0,seals:0,points:0,levelBefore:this.profile.level,levelAfter:this.profile.level,firstClear:false,duplicate:true}} : this.deps.progression.reward(clone(this.profile),result);
    const profile=result.won&&result.eligible&&!already&&!outcome.receipt.duplicate ? this.deps.campaign.complete(outcome.profile,result.mapId,result.modeId,true) : outcome.profile;
    const run=this.engine ? this.engine.getSnapshot() : this.saved;
    if(run && this.engine)run.events=[];
    this.persist(profile,run);this.receipt=outcome.receipt;this.presented=true;
    return {result,receipt:this.receipt};
  }
  close(): void {
    this.unsubscribe?.();this.unsubscribe=null;this.unsubscribeStatus?.();this.unsubscribeStatus=null;
    const client=this.client;this.client=null;client?.close();
    this.engine=null;this.state=null;this.room=null;this.kind='idle';this.config=this.deps.config;
    this.playerId='solo';this.resumeToken=undefined;this.seq=0;this.remoteSeq=-1;this.lastEvent=-1;this.remoteEvents=[];this.pending.clear();this.result=null;this.receipt=null;this.presented=false;this.runKey='';
  }
}
