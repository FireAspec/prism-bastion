import {describe,it,expect} from 'vitest';
import type {Difficulty,GameCommand,GameConfig,GameState,PathIndex} from '../../src/contracts';
import {createGame,restoreGame} from '../../src/engine';
import {credit} from '../../src/contracts/runtime';
import {combat,effect,fixture,options,players} from './fixtures';

const tick=1/60;
const pos=(x:number,y:number)=>({x,y});
const place=(tower='needle',x=350,y=350,actor?:string):GameCommand=>({
 type:'place',tower,pos:pos(x,y),...(actor?{actor}:{})
});
const next=(game:ReturnType<typeof createGame>,n:number)=>{
 for(let i=0;i<n;i++)game.step(tick);
};

describe('deterministic state machine',()=>{
 it('keeps configuration, options, snapshots, positions and events isolated',()=>{
  const cfg=fixture(),opt=options(),game=createGame(cfg,opt,combat('clear'));
  const command=place();expect(game.dispatch(command).ok).toBe(true);
  (command as Extract<GameCommand,{type:'place'}>).pos.x=800;
  cfg.towers[0].cost=9999;opt.unlockedTowers.length=0;
  const snapshot=game.getSnapshot();expect(snapshot.towers[0].pos).toEqual(pos(350,350));
  snapshot.towers[0].pos.x=999;snapshot.options.players[0].name='tampered';
  snapshot.events[0].pos!.x=999;
  expect(game.getSnapshot().towers[0].pos).toEqual(pos(350,350));
  expect(game.getSnapshot().options.players[0].name).toBe('player0');
  const event=game.drainEvents()[0];event.pos!.x=999;
  expect(game.drainEvents()).toEqual([]);
  expect(game.getSnapshot().events).toEqual([]);
 });
 it('matches identical seeds and exact save/restore trajectories, including event sequence',()=>{
  const config=fixture(),opt=options({seed:314159});
  const one=createGame(config,opt,combat('random'));
  const two=createGame(config,opt,combat('random'));
  for(const g of [one,two]){
   expect(g.dispatch({type:'autoStart',value:true}).ok).toBe(true);
   next(g,7);
  }
  expect(one.getSnapshot()).toEqual(two.getSnapshot());
  const saved=one.getSnapshot();
  const restored=restoreGame(config,JSON.parse(JSON.stringify(saved)) as GameState,combat('random'));
  next(one,100);next(two,100);next(restored,100);
  expect(restored.getSnapshot()).toEqual(one.getSnapshot());
  expect(two.getSnapshot()).toEqual(one.getSnapshot());
  const different=createGame(config,options({seed:314160}),combat('random'));
  different.dispatch({type:'autoStart',value:true});next(different,107);
  expect(different.getSnapshot().rng).not.toBe(one.getSnapshot().rng);
 });
 it('pauses timers without drift, handles frame cap, speed and deterministic stepped acceleration',()=>{
  const game=createGame(fixture(),options(),combat('idle'));
  game.dispatch({type:'startWave'});
  game.step(tick);
  const before=game.getSnapshot();
  game.dispatch({type:'pause',value:true});
  game.step(100000);game.step(tick);
  expect(game.getSnapshot().tick).toBe(before.tick);
  expect(game.getSnapshot().waveTime).toBe(before.waveTime);
  game.dispatch({type:'pause',value:false});
  game.step(10);
  expect(game.getSnapshot().tick).toBe(before.tick+15);
  game.dispatch({type:'speed',value:3});game.step(tick);
  expect(game.getSnapshot().tick).toBe(before.tick+18);
  const repeated=createGame(fixture(),options(),combat('idle'));
  repeated.dispatch({type:'startWave'});
  next(repeated,19);
  expect(repeated.getSnapshot().tick).toBe(game.getSnapshot().tick);
  expect(repeated.getSnapshot().time).toBe(game.getSnapshot().time);
  expect(()=>game.step(-1)).toThrow();
 });
 it('spawns at group timestamps, honors per-map replacement, lane distance and leak damage',()=>{
  const cfg=fixture();
  cfg.maps[0].waveOverrides[1]={groups:[
   {enemy:'orb',count:2,at:0,every:0.5,lane:1,hpMul:2,speedMul:2},
  ]};
  const game=createGame(cfg,options(),combat('idle'));
  game.dispatch({type:'startWave'});
  next(game,1);
  let s=game.getSnapshot();
  expect(s.enemies).toHaveLength(1);
  expect(s.enemies[0].lane).toBe(1);
  expect(s.enemies[0].hp).toBe(4);
  expect(s.enemies[0].pos.y).toBe(384);
  next(game,29);
  s=game.getSnapshot();
  expect(s.enemies).toHaveLength(2);
  expect(s.enemies[0].progress).toBeCloseTo(120,6);
  // The second lane turns at 100px, then continues horizontally.
  expect(s.enemies[0].pos).toEqual(pos(120,480));
  next(game,120);
  expect(game.getSnapshot().stats.leaks).toBe(2);
  expect(game.getSnapshot().lives).toBe(146);
  expect(game.getSnapshot().phase).toBe('build');
 });
 it('restores an unfinished spawn group exactly once, with no spawn-time reset',()=>{
  const cfg=fixture();cfg.maps[0].waveOverrides[1]={groups:[
   {enemy:'orb',count:3,at:0.1,every:0.25,lane:0},
  ]};
  const a=createGame(cfg,options(),combat('idle'));
  a.dispatch({type:'startWave'});next(a,20);
  expect(a.getSnapshot().spawnCursor).toEqual([1]);
  const saved=a.getSnapshot(),b=restoreGame(cfg,saved,combat('idle'));
  next(a,45);next(b,45);
  expect(b.getSnapshot()).toEqual(a.getSnapshot());
  expect(b.getSnapshot().spawnCursor).toEqual([3]);
  expect(b.getSnapshot().enemies.map(e=>e.id)).toEqual(['e1','e2','e3']);
 });
 it('moves around corners by arc length and applies slow/freeze without backward drift',()=>{
  const cfg=fixture();cfg.enemies[0].speed=60;
  cfg.maps[0].waveOverrides[1]={groups:[{enemy:'orb',count:1,at:0,every:0,lane:1}]};
  const original=createGame(cfg,options(),combat('idle'));
  original.dispatch({type:'startWave'});next(original,1);
  const s=original.getSnapshot();
  s.enemies[0].progress=90;s.enemies[0].pos=pos(100,470);
  s.enemies[0].statuses=[{kind:'slow',power:0.5,duration:10,remaining:10,source:'test',stacks:1}];
  const slow=restoreGame(cfg,s,combat('idle'));
  next(slow,60);
  expect(slow.getSnapshot().enemies[0].progress).toBeCloseTo(120);
  expect(slow.getSnapshot().enemies[0].pos).toEqual(pos(120,480));
  const frozen=slow.getSnapshot();
  frozen.enemies[0].statuses=[{kind:'stun',power:1,duration:10,remaining:10,source:'test',stacks:1}];
  const stopped=restoreGame(cfg,frozen,combat('idle'));
  next(stopped,60);
  expect(stopped.getSnapshot().enemies[0].progress).toBeCloseTo(120);
 });
 it('defeats at zero lives without paying the unearned wave reward',()=>{
  const cfg=fixture();cfg.difficulties[1].lives=1;
  cfg.maps[0].waveOverrides[1]={groups:[{enemy:'orb',count:1,at:0,every:0,lane:0}]};
  const game=createGame(cfg,options(),combat('idle'));
  game.dispatch({type:'startWave'});next(game,180);
  const s=game.getSnapshot();
  expect(s.phase).toBe('defeat');expect(s.lives).toBe(0);
  expect(s.stats.earned).toBe(0);
  expect(game.drainEvents().filter(e=>e.kind==='defeat')).toHaveLength(1);
  next(game,100);expect(game.getSnapshot()).toEqual({...s,events:[]});
  expect(game.dispatch(place()).ok).toBe(false);
 });
 it.each(['easy','normal','hard','extreme'] as Difficulty[])(
  'completes the entire %s difficulty prefix and emits one victory',(difficulty)=>{
   const cfg=fixture(),game=createGame(cfg,options({difficulty}),combat('clear'));
   game.dispatch({type:'autoStart',value:true});
   for(let i=0;i<10;i++)game.step(0.25);
   const s=game.getSnapshot();
   const rounds=cfg.difficulties.find(d=>d.id===difficulty)!.rounds;
   expect(s.wave).toBe(rounds);
   expect(s.phase).toBe('victory');
   expect(s.stats.earned).toBe(
    rounds*cfg.difficulties.find(d=>d.id===difficulty)!.roundRewardBase+
    cfg.difficulties.find(d=>d.id===difficulty)!.roundRewardStep*rounds*(rounds+1)/2
   );
   const events=game.drainEvents();
   expect(events.filter(e=>e.kind==='waveStart')).toHaveLength(rounds);
   expect(events.filter(e=>e.kind==='waveEnd')).toHaveLength(rounds);
   expect(events.filter(e=>e.kind==='victory')).toHaveLength(1);
   game.step(0.25);expect(game.drainEvents()).toEqual([]);
  });
 it('allows endless waves only after the prefix and emits the milestone once',()=>{
  const cfg=fixture();cfg.difficulties[0].rounds=2;
  const game=createGame(cfg,options({difficulty:'easy',endless:true}),combat('clear'));
  game.dispatch({type:'autoStart',value:true});
  next(game,4);
  const events=game.drainEvents();
  expect(events.filter(e=>e.kind==='victory')).toHaveLength(1);
  expect(game.getSnapshot().wave).toBeGreaterThan(2);
  expect(game.getSnapshot().phase).toBe('wave');
 });
});

describe('transactions, geometry, and team rules',()=>{
 it('rejects locked blueprints, path clipping, pond clipping, obstacles and collisions',()=>{
  const cfg=fixture(),game=createGame(cfg,options({unlockedTowers:['needle','boat']}),combat());
  expect(game.dispatch(place('bank')).reason).toBe('locked-tower');
  for(const p of [pos(3,350),pos(150,319),pos(460,260),pos(600,275),pos(460,210)])
   expect(game.dispatch({type:'place',tower:'needle',pos:p}).reason).toBe('invalid-placement');
  expect(game.dispatch(place('needle',350,350)).ok).toBe(true);
  expect(game.dispatch(place('needle',373,350)).reason).toBe('invalid-placement');
  expect(game.dispatch(place('boat',610,170)).reason).toBe('invalid-placement');
  expect(game.dispatch(place('boat',700,170)).ok).toBe(true);
  expect(game.dispatch(place('boat',590,170)).reason).toBe('invalid-placement');
 });
 it('serializes two purchases against the same money, never spending below zero',()=>{
  const cfg=fixture();cfg.difficulties[1].startCredits=100;
  const game=createGame(cfg,options({players:players(2)}),combat());
  // Cooperative pool = 125; first purchase costs 100 and second cannot pass.
  expect(game.dispatch(place('needle',350,350,'p0')).ok).toBe(true);
  expect(game.dispatch(place('needle',400,350,'p1')).reason).toBe('insufficient-credits');
  expect(game.getSnapshot().credits).toBe(25);
  expect(game.getSnapshot().stats.spent).toBe(100);
 });
 it('accepts an exactly affordable purchase and rejects one-credit shortfall',()=>{
  const cfg=fixture();cfg.difficulties[1].startCredits=100;
  const exact=createGame(cfg,options(),combat());
  expect(exact.dispatch(place()).ok).toBe(true);
  expect(exact.getSnapshot().credits).toBe(0);
  cfg.difficulties[1].startCredits=99;
  const short=createGame(cfg,options(),combat());
  expect(short.dispatch(place()).reason).toBe('insufficient-credits');
  expect(short.getSnapshot().credits).toBe(99);
 });
 it('enforces per-owner actions and server-only global control in multiplayer',()=>{
  const game=createGame(fixture(),options({players:players(2)}),combat());
  expect(game.dispatch(place('needle',350,350)).reason).toBe('invalid-actor');
  const first=game.dispatch(place('needle',350,350,'p0')).entity!;
  const foreign=[
   {type:'upgrade',tower:first,path:0,actor:'p1'},
   {type:'sell',tower:first,actor:'p1'},
   {type:'target',tower:first,targeting:'near',actor:'p1'},
   {type:'ability',tower:first,ability:'mint',actor:'p1'},
  ] as GameCommand[];
  foreign.forEach(command=>expect(game.dispatch(command).reason).toBe('not-owner'));
  expect(game.dispatch({type:'pause',value:true,actor:'p0'}).reason).toBe('server-only');
  expect(game.dispatch({type:'startWave',actor:'p0'}).reason).toBe('server-only');
  expect(game.dispatch({type:'speed',value:2,actor:'server'}).ok).toBe(true);
  expect(game.reassignOwner('p0','p1')).toEqual({ok:true,amount:1});
  expect(game.dispatch({type:'target',tower:first,targeting:'last',actor:'p1'}).ok).toBe(true);
  expect(game.dispatch({type:'sell',tower:first,actor:'p1'}).ok).toBe(true);
 });
 it('supports all six full crosspaths, rejects every third branch and both long branches',()=>{
  const orderings:PathIndex[][]=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for(const [main,secondary,third] of orderings){
   const cfg=fixture();cfg.difficulties[1].startCredits=10000;
   const game=createGame(cfg,options(),combat());
   const id=game.dispatch(place()).entity!;
   for(let i=0;i<5;i++)expect(game.dispatch({type:'upgrade',tower:id,path:main}).ok).toBe(true);
   for(let i=0;i<2;i++)expect(game.dispatch({type:'upgrade',tower:id,path:secondary}).ok).toBe(true);
   const tiers=game.getSnapshot().towers[0].tiers;
   expect(tiers[main]).toBe(5);expect(tiers[secondary]).toBe(2);expect(tiers[third]).toBe(0);
   expect(game.dispatch({type:'upgrade',tower:id,path:secondary}).reason).toBe('invalid-crosspath');
   expect(game.dispatch({type:'upgrade',tower:id,path:third}).reason).toBe('invalid-crosspath');
  }
  const game=createGame(fixture(),options(),combat());
  const id=game.dispatch(place()).entity!;
  game.dispatch({type:'upgrade',tower:id,path:0});
  game.dispatch({type:'upgrade',tower:id,path:1});
  expect(game.dispatch({type:'upgrade',tower:id,path:2}).reason).toBe('invalid-crosspath');
 });
 it('reserves each T5 specialization team-wide; sale releases a slot',()=>{
  const cfg=fixture();cfg.difficulties[1].startCredits=10000;
  const game=createGame(cfg,options({players:players(2)}),combat());
  const a=game.dispatch(place('needle',350,350,'p0')).entity!;
  const b=game.dispatch(place('needle',400,350,'p1')).entity!;
  for(let i=0;i<5;i++)expect(game.dispatch({type:'upgrade',tower:a,path:0,actor:'p0'}).ok).toBe(true);
  for(let i=0;i<4;i++)expect(game.dispatch({type:'upgrade',tower:b,path:0,actor:'p1'}).ok).toBe(true);
  expect(game.dispatch({type:'upgrade',tower:b,path:0,actor:'p1'}).reason).toBe('team-tier-five-limit');
  expect(game.dispatch({type:'sell',tower:a,actor:'p0'}).ok).toBe(true);
  expect(game.dispatch({type:'upgrade',tower:b,path:0,actor:'p1'}).ok).toBe(true);
 });
 it('allows distinct specializations of one type while applying low-tech tier caps',()=>{
  const cfg=fixture();cfg.difficulties[1].startCredits=5000;
  const game=createGame(cfg,options(),combat());
  const a=game.dispatch(place()).entity!;
  const b=game.dispatch(place('needle',400,350)).entity!;
  for(let i=0;i<5;i++){
   expect(game.dispatch({type:'upgrade',tower:a,path:0}).ok).toBe(true);
   expect(game.dispatch({type:'upgrade',tower:b,path:1}).ok).toBe(true);
  }
  expect(game.getSnapshot().towers.map(t=>t.tiers)).toEqual([[5,0,0],[0,5,0]]);
  const limited=createGame(cfg,options({modeId:'low-tech'}),combat());
  const id=limited.dispatch(place()).entity!;
  for(let i=0;i<3;i++)expect(limited.dispatch({type:'upgrade',tower:id,path:0}).ok).toBe(true);
  expect(limited.dispatch({type:'upgrade',tower:id,path:0}).reason).toBe('tier-limit');
 });
 it('uses actual discounted purchase and all crosspath spending for exact sale value',()=>{
  const cfg=fixture();cfg.knowledgeDiscount=0.08;
  cfg.towers[1].effects=[effect('aura',0.15,100,'discount')];
  const game=createGame(cfg,options(),combat());
  const support=game.dispatch(place('bank',350,350)).entity!;
  const purchased=game.dispatch(place('needle',410,350));
  expect(purchased.amount).toBe(80);
  const id=purchased.entity!;
  for(let i=0;i<5;i++)expect(game.dispatch({type:'upgrade',tower:id,path:0}).amount).toBe(8);
  for(let i=0;i<2;i++)expect(game.dispatch({type:'upgrade',tower:id,path:1}).amount).toBe(8);
  expect(game.getSnapshot().towers.find(t=>t.id===id)?.invested).toBe(136);
  const before=game.getSnapshot().credits;
  expect(game.dispatch({type:'sell',tower:id}).amount).toBe(95);
  expect(game.getSnapshot().credits).toBe(before+95);
  expect(game.dispatch({type:'sell',tower:support}).ok).toBe(true);
 });
});

describe('accounting and challenge boundaries',()=>{
 it('pays each 1-credit layer as half-cash with cent carry and exactly one wave reward',()=>{
  const game=createGame(fixture(),options({modeId:'half-cash'}),combat('layers'));
  expect(game.getSnapshot().credits).toBe(450);
  game.dispatch({type:'startWave'});game.step(tick);
  const s=game.getSnapshot();
  expect(s.credits).toBe(493);expect(s.stats.earned).toBe(43);
  expect(s.stats.cashSubunits).toBe(0);
  expect(game.drainEvents().filter(e=>e.kind==='income').map(e=>e.amount)).toEqual([1,42]);
  game.step(tick);expect(game.getSnapshot().stats.earned).toBe(43);
 });
 it('carries a single half-credit across save/restore and combines it with later income',()=>{
  const cfg=fixture();
  cfg.enemies[0].hp=1;cfg.enemies[0].bounty=1;cfg.enemies[0].layers=[{hp:1,cash:1,color:'red'}];
  cfg.waves[0].groups=[{enemy:'orb',count:1,at:0,every:0,lane:0}];
  const paidSingleLayer={
   ...combat('idle'),
   step(s:GameState){
    for(const e of s.enemies){
     if(!e.paidLayers.includes(0)){
      credit(s,1*s.rules.popCashMul*s.rules.incomeMul);
      e.paidLayers.push(0);
     }
    }
    s.enemies.length=0;
   },
  };
  const a=createGame(cfg,options({modeId:'half-cash'}),paidSingleLayer);
  a.dispatch({type:'startWave'});a.step(tick);
  const saved=a.getSnapshot();
  expect(saved.stats.cashSubunits).toBe(50);
  const b=restoreGame(cfg,saved,paidSingleLayer);
  expect(b.getSnapshot().stats.cashSubunits).toBe(50);
  b.dispatch({type:'startWave'});b.step(tick);
  expect(b.getSnapshot().stats.cashSubunits).toBe(0);
  expect(b.getSnapshot().credits).toBe(537);
  b.getSnapshot().stats.cashSubunits=70; // Mutating a renderer copy has no effect.
  expect(b.getSnapshot().stats.cashSubunits).toBe(0);
 });
 it('applies income and interest once, with independent caps and no reward compounding',()=>{
  const cfg=fixture();
  cfg.towers[1].effects=[effect('income',5),effect('interest',0.1,12)];
  const game=createGame(cfg,options(),combat('clear'));
  const bank=game.dispatch(place('bank')).entity!;
  expect(bank).toBeDefined();
  game.dispatch({type:'startWave'});game.step(tick);
  // 900-100=800 opening balance => 12 capped interest, +5 income, +84 round.
  expect(game.getSnapshot().credits).toBe(901);
  expect(game.getSnapshot().towers[0].generated).toBe(17);
  game.step(tick);expect(game.getSnapshot().credits).toBe(901);
 });
 it('forbids every passive income path in iron-oath, including upgrade effects and money abilities',()=>{
  const cfg=fixture();cfg.towers[1].effects=[
   effect('income',100),effect('interest',1),effect('harvest',99),effect('barrier',999),
  ];
  cfg.towers[1].paths[0].upgrades[0].effects=[effect('income',100)];
  const verifyingCombat=combat('clear');
  const checked={
   ...verifyingCombat,
   step(s:GameState,c:GameConfig,dt:number){
    for(const t of c.towers){
     expect(t.effects.some(e=>['income','interest','harvest','barrier'].includes(e.kind))).toBe(false);
     expect(t.paths.flatMap(p=>p.upgrades).some(u=>
      u.effects?.some(e=>['income','interest','harvest','barrier'].includes(e.kind)))).toBe(false);
     expect(t.abilities.some(a=>a.kind==='mint'||a.kind==='barrier')).toBe(false);
    }
    verifyingCombat.step(s,c,dt);
   },
  };
  const game=createGame(cfg,options({modeId:'iron-oath'}),checked);
  const id=game.dispatch(place('bank')).entity!;
  game.dispatch({type:'upgrade',tower:id,path:0});
  expect(game.dispatch({type:'ability',tower:id,ability:'mint'}).ok).toBe(false);
  expect(game.dispatch({type:'ability',tower:id,ability:'barrier'}).ok).toBe(false);
  expect(game.dispatch({type:'sell',tower:id}).ok).toBe(false);
  game.dispatch({type:'startWave'});game.step(tick);
  expect(game.getSnapshot().credits).toBe(874);
  expect(game.getSnapshot().lives).toBe(1);
 });
 it('prevents barrier extra life in no-leaks but leaves ordinary farm income enabled',()=>{
  const cfg=fixture();cfg.towers[1].effects=[effect('income',5),effect('barrier',100)];
  const game=createGame(cfg,options({modeId:'no-leaks'}),combat('clear'));
  const id=game.dispatch(place('bank')).entity!;
  expect(game.dispatch({type:'ability',tower:id,ability:'barrier'}).ok).toBe(false);
  game.dispatch({type:'startWave'});game.step(tick);
  expect(game.getSnapshot().lives).toBe(1);
  expect(game.getSnapshot().credits).toBe(889);
 });
 it('scales team starting resources and enemy HP, not repeated income rewards',()=>{
  for(const [team,scale] of [[1,1],[2,1.25],[3,1.5],[4,1.75]]){
   const game=createGame(fixture(),options({players:players(team)}),combat('idle'));
   expect(game.getSnapshot().credits).toBe(900*scale);
   game.dispatch({type:'startWave',actor:team===1?undefined:'server'});
   game.step(tick);
   expect(game.getSnapshot().enemies[0].maxHp).toBe(2*scale);
   expect(game.getSnapshot().rules.enemyHpMul).toBe(scale);
  }
 });
 it('rejects tampered saved balances, ownership, and wave cursors',()=>{
  const cfg=fixture(),game=createGame(cfg,options(),combat());
  const s=game.getSnapshot();s.credits=-1;
  expect(()=>restoreGame(cfg,s,combat())).toThrow('Invalid saved game');
  const s2=game.getSnapshot();s2.rules.incomeMul=5000;
  expect(()=>restoreGame(cfg,s2,combat())).toThrow('Saved run');
  const s3=game.getSnapshot();
  game.dispatch({type:'startWave'});
  const s4=game.getSnapshot();s4.spawnCursor=[500];
  expect(()=>restoreGame(cfg,s4,combat())).toThrow('Invalid spawn cursor');
  expect(restoreGame(cfg,s3,combat()).getSnapshot()).toEqual(s3);
  const s5=game.getSnapshot();
  s5.towers=[
   {id:'t1',defId:'needle',owner:'p0',pos:pos(350,350),tiers:[5,0,0],targeting:'first',
    invested:100,cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0},
   {id:'t2',defId:'needle',owner:'p0',pos:pos(400,350),tiers:[5,0,0],targeting:'first',
    invested:100,cooldown:0,abilityCooldowns:{},memory:{},damageDealt:0,kills:0,generated:0},
  ];
  expect(()=>restoreGame(cfg,s5,combat())).toThrow('Duplicate saved tier-five specialization');
 });
});
