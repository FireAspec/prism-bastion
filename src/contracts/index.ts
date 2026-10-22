/** Public module boundary, version 1. Units: world pixels, seconds, credits. */
export const CONTRACT_VERSION = 1 as const;
export const WORLD = {width:1280, height:720, tick:1/60} as const;
export type Vec = {x:number; y:number};
export type PathIndex = 0|1|2;
export type Tiers = [number,number,number];
export type Difficulty = 'easy'|'normal'|'hard'|'extreme';
export type Targeting = 'first'|'last'|'strong'|'near';
export type Element = 'kinetic'|'fire'|'frost'|'electric'|'acid'|'energy';
export type AttackMode = 'shot'|'cone'|'beam'|'chain'|'splash'|'ring'|'mortar'|'mine'|'drone'|'pulse'|'tide'|'melee';
export type StatusKind = 'burn'|'poison'|'slow'|'freeze'|'stun'|'mark'|'shred'|'wet'|'reveal';
export interface StatusSpec {kind:StatusKind; power:number; duration:number; maxStacks?:number;}
export interface AppliedStatus extends StatusSpec {source:string; remaining:number; stacks:number;}
export interface AttackDef {
 mode:AttackMode; element:Element; damage:number; interval:number; range:number;
 pierce:number; count:number; splash:number; chains:number; chainRadius:number;
 detects:boolean; armorPierce:number; shieldMultiplier:number; bossMultiplier:number;
 executeBelow:number; push:number; statuses:StatusSpec[];
 projectileSpeed:number;projectileRadius:number;homing:boolean;windup:number;arc:number;
}
export type EffectKind = 'aura'|'income'|'interest'|'charge'|'focus'|'deathBurst'|'copy'|'portal'|'barrier'|'harvest'|'trap'|'echo';
export interface EffectDef {
 id:string; kind:EffectKind; power:number; radius:number; interval:number;
 duration:number; cap:number; stat?:'damage'|'attackSpeed'|'range'|'armorPierce'|'detect'|'discount';
 element?:Element; status?:StatusSpec;
}
export interface AbilityDef {
 id:string; name:string; description:string; cooldown:number; kind:'nova'|'overclock'|'meteor'|'rewind'|'barrier'|'mint';
 power:number; duration:number; radius:number; element:Element;
}
export interface StatDelta {
 damageMul?:number; intervalMul?:number; rangeMul?:number; pierceAdd?:number; countAdd?:number;
 splashAdd?:number; chainsAdd?:number; chainRadiusAdd?:number; armorPierceAdd?:number;
 shieldMultiplierMul?:number; bossMultiplierMul?:number; executeBelowAdd?:number; pushAdd?:number; detects?:boolean;
 projectileSpeedMul?:number;windupMul?:number;arcAdd?:number;
}
export interface VisualState {
 /** full SVG in public/art/towers/<tower-id>/, no network fetches */
 asset:string; accent:string; muzzle:string; projectile:string; impact:string;
 scale:number; glow:number; motion:'none'|'rotate'|'pulse'|'orbit'|'breathe';
}
export interface UpgradeDef {
 id:string; name:string; description:string; cost:number; tier:1|2|3|4|5;
 delta:StatDelta; replaceAttack?:AttackDef; addStatuses?:StatusSpec[];
 effects?:EffectDef[]; abilities?:AbilityDef[]; visual:VisualState;
}
export interface UpgradePath {id:string; name:string; description:string; upgrades:UpgradeDef[];}
export interface TowerDef {
 id:string; name:string; description:string; category:'weapon'|'element'|'tech'|'support'|'economy'|'water';
 cost:number; footprint:number; placement:'land'|'water'|'either';
 attack:AttackDef; effects:EffectDef[]; abilities:AbilityDef[];
 visual:VisualState; paths:[UpgradePath,UpgradePath,UpgradePath];
}
export interface ResolvedTower {
 attack:AttackDef; effects:EffectDef[]; abilities:AbilityDef[];
 visual:VisualState; secondaryOverlay?:string; mainPath?:PathIndex;
}
export interface TowerState {
 id:string; defId:string; owner:string; pos:Vec; tiers:Tiers; targeting:Targeting; invested:number;
 cooldown:number; abilityCooldowns:Record<string,number>; memory:Record<string,number>;
 damageDealt:number; kills:number; generated:number;
}
export interface BossPhase {atHealth:number; shield:number; speedMul:number; spawn?:string; count:number; interval:number;}
export interface EnemyDef {
 id:string; name:string; description:string; color:string; shape:'orb'|'diamond'|'hex'|'shard'|'crown';
 hp:number; speed:number; bounty:number; leak:number; radius:number; armor:number;
 shield:number; regen:number; cloaked:boolean; flying:boolean;
 resist:Partial<Record<Element,number>>; children:{id:string;count:number}[];
 boss?:{controlFactor:number; phases:BossPhase[]};
 layers:{hp:number;cash:number;color:string}[];
}
export interface EnemyState {
 id:string; defId:string; lane:number; progress:number; pos:Vec; hp:number; maxHp:number;
 shield:number; maxShield:number; statuses:AppliedStatus[]; memory:Record<string,number>;
 bountyPaid:boolean; generation:number;
 paidLayers:number[];
}
export interface SpawnGroup {enemy:string; count:number; at:number; every:number; lane:number; hpMul?:number;speedMul?:number;}
export interface WaveDef {number:number; groups:SpawnGroup[]; reward:number; preview:string; boss?:string;}
export interface MapDef {
 id:string; name:string; description:string; difficulty:1|2|3|4; campaignIndex:number;
 recommendedDifficulty:Difficulty;
 waveOverrides:Record<number,Partial<WaveDef>>;
 lanes:Vec[][]; pathWidth:number; blocked:Vec[][]; water:Vec[][];
 theme:'garden'|'foundry'|'estuary'; background:string;
}
export interface PlayerInfo {id:string;name:string;color:string;connected:boolean;}
export interface RunOptions {
 mapId:string; difficulty:Difficulty; seed:number; endless:boolean;modeId:string;
 unlockedTowers:string[]; players:PlayerInfo[];
 runId:string;knowledge:string[];
}
export interface RuleModifiers {
 incomeMul:number;startingCashMul:number;enemyHpMul:number;enemySpeedMul:number;towerCostMul:number;
 sellAllowed:boolean;maxLives:number;allowAbilities:boolean;allowPassiveIncome:boolean;
 maxTowers:number;maxTier:number;weather:'none'|'alternating'|'fog';
 allowKnowledge:boolean;
 rounds:number;roundRewardBase:number;roundRewardStep:number;popCashMul:number;
}
export interface DifficultyDef {
 id:Difficulty;name:string;rounds:number;lives:number;startCredits:number;towerCostMul:number;
 enemyHpMul:number;roundRewardBase:number;roundRewardStep:number;popCashMul:number;rewardMul:number;
}
export interface ModeDef {id:string;name:string;description:string;modifiers:Partial<RuleModifiers>;requiresClear:boolean;}
export interface CampaignNode {id:string;mapId:string;prerequisites:string[];unlocks:string[];title:string;briefing:string;outro:string;}
export interface GameConfig {
 version:1; towers:TowerDef[]; enemies:EnemyDef[]; waves:WaveDef[]; maps:MapDef[];
 modes:ModeDef[];campaign:CampaignNode[];contentVersion:string;contentDigest:string;
 knowledge:KnowledgeNode[];economy:EconomyConfig;
 difficulties:DifficultyDef[];
 knowledgeDiscount:number;
 startCredits:number; startLives:number; sellRatio:0.7;
 endlessWave?:(wave:number,seed:number)=>WaveDef;
}
export interface GameEvent {
 id:number; time:number; kind:'shot'|'projectileSpawn'|'projectileImpact'|'strikeStart'|'strikeContact'|'miss'|'hit'|'layerBreak'|'shieldBreak'|'kill'|'leak'|'spawn'|'upgrade'|'place'|'sell'|'ability'|'bossPhase'|'waveStart'|'waveEnd'|'victory'|'defeat'|'income';
 source?:string; target?:string; pos?:Vec; to?:Vec; amount?:number; element?:Element; visual?:string;
 layer?:number;fromVisual?:string;toVisual?:string;
}
export interface ProjectileState {
 id:string;source:string;pos:Vec;previous:Vec;velocity:Vec;target:string|null;
 remainingLife:number;remainingPierce:number;hitTargets:string[];attack:AttackDef;visual:string;
}
export interface StrikeState {
 id:string;source:string;pos:Vec;direction:Vec;remainingWindup:number;remainingActive:number;
 attack:AttackDef;hitTargets:string[];visual:string;
}
export interface GameState {
 version:1; options:RunOptions; phase:'build'|'wave'|'victory'|'defeat'; time:number;
 rules:RuleModifiers;
 tick:number; rng:number; nextEntity:number; nextEvent:number; credits:number; lives:number;
 wave:number; waveTime:number; spawnCursor:number[]; paused:boolean; speed:1|2|3; autoStart:boolean;
 towers:TowerState[]; enemies:EnemyState[]; events:GameEvent[];
 projectiles:ProjectileState[];strikes:StrikeState[];
 stats:{spent:number; earned:number; kills:number; damage:number; leaks:number; abilities:number;cashSubunits:number};
}
export type GameAction =
 | {type:'place';tower:string;pos:Vec}
 | {type:'upgrade';tower:string;path:PathIndex}
 | {type:'sell';tower:string}
 | {type:'target';tower:string;targeting:Targeting}
 | {type:'ability';tower:string;ability:string}
 | {type:'startWave'} | {type:'pause';value:boolean} | {type:'speed';value:1|2|3}
 | {type:'autoStart';value:boolean};
export type GameCommand = GameAction & {actor?:string;requestId?:string};
export interface CommandResult {ok:boolean; reason?:string; entity?:string; amount?:number;pending?:boolean;requestId?:string;}
export interface CombatModule {
 resolveTower(def:TowerDef,tiers:Tiers):ResolvedTower;
 step(state:GameState,config:GameConfig,dt:number):void;
 activate(state:GameState,config:GameConfig,tower:string,ability:string):CommandResult;
}
export interface GameEngine {
 dispatch(command:GameCommand):CommandResult;
 step(realSeconds:number):void;
 getSnapshot():GameState;
 drainEvents():GameEvent[];
 reassignOwner(fromPlayerId:string,toPlayerId:string):CommandResult;
}
export interface DamagePacket {source:string; damage:number; element:Element;armorPierce:number;shieldMultiplier:number;bossMultiplier:number;statuses:StatusSpec[];}
export interface RenderPreferences {reducedMotion:boolean;quality:'low'|'high';colorblind:boolean;}
export interface RenderOverlay {selected?:string;placement?:{tower:string;pos:Vec;valid:boolean};preferences:RenderPreferences;}
export interface GameRenderer {
 render(state:GameState,overlay:RenderOverlay,events:GameEvent[],realSeconds:number):void;
 screenToWorld(clientX:number,clientY:number):Vec; resize():void; dispose():void;
}
export interface UIHooks {command:(command:GameCommand)=>CommandResult;chooseTower:(id:string|null)=>void;select:(id:string|null)=>void;exit:()=>void;playerId?:string;isHost?:boolean;}
export interface HUD {
 update(state:GameState,selected:string|null,placing:string|null):void;
 notify(message:string):void; dispose():void;
}
export interface Settings extends RenderPreferences {master:number;music:number;sfx:number;language:'ru'|'en';fullscreen:boolean;}
export interface Profile {
 version:1; settings:Settings; medals:Record<string,number>; unlockedCosmetics:string[];
 bestWave:Record<string,number>; completedRuns:number; tutorialSeen:boolean;
 completedNodes:string[];unlockedTowers:string[];
 xp:number;level:number;seals:number;knowledgePoints:number;
 knowledgeUnlocked:string[];knowledgePaid:string[];claimedRuns:string[];respecCount:number;
}
export interface SaveEnvelope {version:1; savedAt:string;contentVersion:string;profile:Profile;run:GameState|null;}
export interface SaveStore {
 load():SaveEnvelope; save(value:SaveEnvelope):void; export():string; import(json:string):SaveEnvelope; reset():void;
}
export interface MenuHooks {start:(options:RunOptions)=>void;resume:()=>void;settings:(value:Settings)=>void;knowledge:()=>void;coop:()=>void;exportProfile?:()=>string;importProfile?:(json:string)=>CommandResult;}
export interface MenuUI {show(screen:'title'|'maps'|'settings'|'help'|'victory'|'defeat',profile:Profile,run?:GameState|null,receipt?:RewardReceipt):void;hide():void;dispose():void;}
export interface AudioSystem {unlock():Promise<void>;setSettings(settings:Settings):void;consume(events:GameEvent[]):void;setScene(scene:'menu'|'build'|'wave'|'boss'|'end'):void;dispose():void;}
export interface LocaleCatalog {text(key:string,vars?:Record<string,string|number>):string;setLanguage(language:'ru'|'en'):void;}
export interface DesktopBridge {
 setFullscreen(value:boolean):Promise<void>;getVersion():Promise<string>;
 startHost(options:HostOptions,run:RunOptions):Promise<{address:string;port:number;invite:string}>;
 stopHost():Promise<void>;getAddresses():Promise<string[]>;
}
declare global {interface Window {prismDesktop?:DesktopBridge;}}

export const PROTOCOL_VERSION = 1 as const;
export interface HostOptions {port:number;name:string;maxPlayers:2|3|4;password:string;}
export interface RoomState {
 id:string;name:string;hostId:string;players:PlayerInfo[];ready:string[];started:boolean;
 options:RunOptions;protocolVersion:1;contentDigest:string;
}
export type ClientMessage =
 | {type:'join';protocolVersion:1;contentDigest:string;name:string;password:string;resumeToken?:string;knowledge?:string[]}
 | {type:'command';seq:number;command:GameAction}
 | {type:'ready';value:boolean}
 | {type:'start'} | {type:'ping';at:number};
export type ServerMessage =
 | {type:'welcome';playerId:string;resumeToken:string;room:RoomState}
 | {type:'room';room:RoomState}
 | {type:'snapshot';seq:number;state:GameState;events:GameEvent[]}
 | {type:'result';seq:number;result:CommandResult}
 | {type:'runResult';result:RunResult}
 | {type:'error';code:string;message:string}
 | {type:'pong';at:number};
export interface CoopClient {
 connect(url:string,hello:Extract<ClientMessage,{type:'join'}>):Promise<void>;
 send(message:Exclude<ClientMessage,{type:'join'}>):void;
 subscribe(listener:(message:ServerMessage)=>void):()=>void;
 close():void;
}
export interface LobbyUI {
 show(profile:Profile):void;update(room:RoomState,status:string):void;hide():void;dispose():void;
}
export interface LobbyHooks {
 host:(options:HostOptions,run:RunOptions)=>Promise<void>;
 join:(url:string,name:string,password:string)=>Promise<void>;
 ready:(value:boolean)=>void;start:()=>void;leave:()=>void;
}
export type KnowledgeStat = 'weaponDamage'|'weaponSpeed'|'weaponRange'|'elementDamage'|'statusDuration'|'shieldDamage'|'supportRadius'|'abilityCooldown'|'controlDuration'|'startingCash'|'passiveIncome'|'purchaseDiscount'|'lives'|'bossDamage'|'revealRadius'|'xpGain'|'sealGain'|'waterDamage'|'waterRange';
export interface KnowledgeEffect {stat:KnowledgeStat;value:number;towers?:string[];}
export interface KnowledgeNode {
 id:string;branch:'ballistics'|'elements'|'engineering'|'commerce'|'lighthouse';index:number;
 name:string;description:string;requires:string[];minLevel:number;pointCost:1;sealCost:number;
 effects:KnowledgeEffect[];icon:string;
}
export interface EconomyConfig {
 xpCurve:[number,number,number];maxRewardLevel:number;pointsPerLevel:number;
 mapXP:[number,number,number,number];mapSeals:[number,number,number,number];
 modeReward:Record<string,number>;firstClearXP:number;repeatXP:number;repeatSeals:number;
 defeatXP:number;respecCost:number;
}
export interface RunResult {
 runId:string;mapId:string;modeId:string;won:boolean;wave:number;rounds:number;
 seed:number;eligible:boolean;durationSeconds:number;contentDigest:string;
 difficulty:Difficulty;
}
export interface RewardReceipt {xp:number;seals:number;points:number;levelBefore:number;levelAfter:number;firstClear:boolean;duplicate:boolean;}
export interface KnowledgeUI {
 show(profile:Profile):void;update(profile:Profile):void;hide():void;dispose():void;
}
