import {describe,it,expect} from 'vitest';
import type {AttackMode,EffectKind,GameState,StatusKind,Tiers} from '../../src/contracts';
import {createCombat,damageEnemy,resolveTower,supportAt,enemySpeedMultiplier} from '../../src/combat';
import {flushChildren} from '../../src/combat/damage';
import {attack,ability,effect,enemy,fixture,placed,status,tower} from './fixtures';

const combat=createCombat();
const step=(s:GameState,c:ReturnType<typeof fixture>['config'],times=1,dt=1/60)=>{
  for(let i=0;i<times;i++){s.time+=dt;s.tick++;combat.step(s,c,dt);}
};
const packet=(source='t1',damage=30)=>({source,damage,element:'kinetic' as const,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,statuses:[]});

describe('fixed attack and upgrade interpretation',()=>{
  it('resolves all six 5-2 crosspaths, keeps main shape, preserves all original data',()=>{
    const def=tower(),before=structuredClone(def);
    const tiers:Tiers[]=[[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
    for(const combination of tiers){
      const result=resolveTower(def,combination);
      const main=combination.indexOf(5),secondary=combination.indexOf(2);
      expect(result.mainPath).toBe(main);
      expect(result.secondaryOverlay).toBe(`${secondary}-2.svg`);
      expect(result.visual.asset).toBe(`${main}-5.svg`);
      expect(result.attack.damage).toBeCloseTo((50+main)*1.1**7,5);
      expect(result.attack.statuses).toHaveLength(2);
      expect(result.attack.mode).toBe('beam');
      result.attack.statuses.length=0;
      expect(def).toEqual(before);
    }
    expect(()=>resolveTower(def,[3,3,0])).toThrow();
    expect(resolveTower(def,[2,2,0]).mainPath).toBe(0);
  });

  it('replaces effects and abilities by ID, while combining compatible statuses',()=>{
    const d=tower('replace','shot',[effect('aura',{id:'same',power:.1})],[ability('nova',{id:'same'})]);
    d.paths[0].upgrades[0].effects=[effect('aura',{id:'same',power:.2})];
    d.paths[1].upgrades[0].effects=[effect('aura',{id:'same',power:.4})];
    d.paths[0].upgrades[0].abilities=[ability('meteor',{id:'same'})];
    d.paths[1].upgrades[0].abilities=[ability('barrier',{id:'same'})];
    const resolved=resolveTower(d,[1,1,0]);
    expect(resolved.effects.find(e=>e.id==='same')?.power).toBe(.4);
    expect(resolved.abilities.find(a=>a.id==='same')?.kind).toBe('barrier');
  });

  it('interprets 30 data-defined towers × 3 T5 specializations without tower-ID branches',()=>{
    const modes:AttackMode[]=['shot','cone','beam','chain','splash','ring','mortar','mine','drone','pulse','tide','melee'];
    for(let n=0;n<30;n++){
      const def=tower(`archetype-${n}`);
      for(let p=0;p<3;p++){
        const mode=modes[(n*3+p)%modes.length];
        def.paths[p].upgrades[4].replaceAttack=attack(mode,{damage:30+2*p,interval:2});
        const tiers=[0,0,0] as Tiers;tiers[p]=5;
        const a=resolveTower(def,tiers).attack;
        expect(a.mode).toBe(mode);
        const {config,state,spawn}=fixture([def]);
        const built=placed(def.id);built.tiers=tiers;state.towers.push(built);
        const victim=spawn();step(state,config,40);
        expect(victim.hp,`${def.id}/${p}/${mode}`).toBeLessThan(100);
      }
    }
  });

  it.each<AttackMode>(['shot','cone','beam','chain','splash','ring','mortar','mine','drone','pulse','tide','melee'])('%s hits a target using simulation contact',mode=>{
    const a=attack(mode,{damage:40,interval:2,count:1,pierce:2,splash:130});
    const d=tower('weapon',mode,[],[],a);
    const {config,state,spawn}=fixture([d]);
    state.towers.push(placed('weapon'));
    const target=spawn('foe',80);
    step(state,config,30);
    expect(target.hp).toBeLessThan(100);
    expect(state.events.some(event=>event.kind==='hit')).toBe(true);
    expect(state.stats.damage).toBeGreaterThan(0);
  });

  it('chain uses distinct victims, projectile pierce reaches multiple bodies',()=>{
    for(const mode of ['chain','shot'] as const){
      const d=tower('weapon',mode,[],[],attack(mode,{damage:20,interval:3,pierce:3,chains:2,chainRadius:50}));
      const {config,state,spawn}=fixture([d]);
      state.towers.push(placed('weapon'));
      const victims=[spawn('foe',55),spawn('foe',80),spawn('foe',105)];
      step(state,config,30);
      expect(victims.every(e=>e.hp<100)).toBe(true);
      expect(state.events.filter(e=>e.kind==='hit').length).toBe(3);
    }
  });

  it('projectile motion and render consumption cannot inflict duplicate hits',()=>{
    const {config,state,spawn}=fixture([tower('weapon','shot',[],[],attack('shot',{interval:5,damage:40}))]);
    state.towers.push(placed('weapon'));spawn();
    step(state,config,20);
    const first=state.stats.damage;
    const events=structuredClone(state.events);
    events.forEach(e=>JSON.stringify(e)); // multiple consumers inspect the same packet
    expect(state.stats.damage).toBe(first);
    step(state,config,20);
    expect(state.stats.damage).toBe(first);
  });
});

describe('single layer, shield and death accounting',()=>{
  it('pays multiple crossed layers once, including half-cash fractional cents',()=>{
    const {config,state,spawn}=fixture(undefined,undefined,{popCashMul:.5});
    const target=spawn();
    damageEnemy(state,config,target.id,packet('x',68));
    expect(target.paidLayers).toEqual([0,1]);
    expect(state.credits).toBe(2);expect(state.stats.cashSubunits).toBe(50);
    damageEnemy(state,config,target.id,packet('x',32));
    expect(state.credits).toBe(5);expect(state.stats.cashSubunits).toBe(0);
    expect(state.stats.kills).toBe(1);
    damageEnemy(state,config,target.id,packet('x',1000));
    expect(state.credits).toBe(5);expect(state.stats.kills).toBe(1);
  });

  it('regeneration cannot reclaim paid layers; armor, resists and shields precede HP',()=>{
    const def=enemy('guard',{armor:10,shield:30,regen:50,resist:{kinetic:.2}});
    const {config,state,spawn}=fixture([], [def]);
    const e=spawn('guard');
    damageEnemy(state,config,e.id,{...packet('x',50),shieldMultiplier:2});
    expect(e.shield).toBe(0);
    expect(e.hp).toBe(85); // 50 * .8 = 40; shield spends 15 raw, minus armor 10
    damageEnemy(state,config,e.id,packet('x',30));
    expect(e.hp).toBe(71);
    expect(e.paidLayers).toEqual([]);
    damageEnemy(state,config,e.id,packet('x',55));
    expect(e.paidLayers).toEqual([0,1]);
    const income=state.stats.earned;
    step(state,config,120);
    expect(e.hp).toBeCloseTo(100);
    damageEnemy(state,config,e.id,packet('x',55));
    expect(state.stats.earned).toBe(income);
  });

  it('DoT, burst and execute pay through one layer formula; kills and children exactly once',()=>{
    const child=enemy('child',{hp:10,bounty:1,layers:[{hp:10,cash:1,color:'red'}],children:[]});
    const parent=enemy('parent',{children:[{id:'child',count:2}],layers:[{hp:100,cash:10,color:'red'}]});
    const def=tower('burner','shot',[effect('deathBurst',{power:20,radius:120})],[],attack('shot',{damage:0}));
    const {config,state,spawn}=fixture([def],[parent,child]);
    state.towers.push(placed('burner'));
    const p=spawn('parent',40),neighbor=spawn('parent',70);
    damageEnemy(state,config,p.id,{...packet('t1',95),statuses:[status('burn',40,1)]});
    step(state,config,20);
    expect(state.stats.kills).toBe(1);
    expect(state.enemies.filter(e=>e.defId==='child')).toHaveLength(2);
    expect(neighbor.hp).toBeLessThan(100);
    const cash=state.credits;
    damageEnemy(state,config,p.id,packet('t1',999));
    expect(state.stats.kills).toBe(1);expect(state.credits).toBe(cash);
  });

  it('boss phase transition is single-shot and hard control has a resistance window',()=>{
    const boss=enemy('boss',{hp:100,armor:0,layers:[{hp:100,cash:10,color:'red'}],boss:{controlFactor:.15,
      phases:[{atHealth:.75,shield:50,speedMul:1.5,count:0,interval:0}]}});
    const {config,state,spawn}=fixture([], [boss]);
    const b=spawn('boss');
    damageEnemy(state,config,b.id,{...packet('x',30),statuses:[status('freeze',1,20)]});
    expect(b.shield).toBe(50);
    expect(b.statuses[0].remaining).toBeLessThanOrEqual(.5);
    damageEnemy(state,config,b.id,{...packet('x',30),statuses:[status('stun',1,20)]});
    expect(b.statuses.filter(s=>s.kind==='stun')).toHaveLength(0);
    expect(state.events.filter(event=>event.kind==='bossPhase')).toHaveLength(1);
    expect(b.memory['combat:phaseSpeed']).toBe(1.5);
    expect(enemySpeedMultiplier(b,boss)).toBeGreaterThan(0);
  });

  it('execute kills ordinary targets below its threshold and merely amplifies boss hits',()=>{
    const hero=tower('finisher','shot',[],[],attack('shot',{damage:10,executeBelow:.5}));
    const normal=enemy('normal',{armor:5,shield:10});
    const boss=enemy('boss',{boss:{controlFactor:.2,phases:[]}});
    const {config,state,spawn}=fixture([hero],[normal,boss]);
    const a=spawn('normal',70),b=spawn('boss',100);
    a.hp=40;b.hp=40;
    state.towers.push(placed('finisher'));
    step(state,config,20);
    expect(state.enemies.some(e=>e.id===a.id)).toBe(false);
    expect(b.hp).toBeGreaterThan(0);
  });

  it('movement adapter respects slow floors, a limited hard stun, phase speed, and bosses',()=>{
    const def=enemy();const {spawn}=fixture([], [def]);const e=spawn();
    e.statuses=[{...status('slow',.99,2),source:'t',remaining:2,stacks:1}];
    expect(enemySpeedMultiplier(e,def)).toBe(.25);
    e.statuses=[{...status('freeze',1,1),source:'t',remaining:1,stacks:1}];
    expect(enemySpeedMultiplier(e,def)).toBe(0);
    const boss=enemy('boss',{boss:{controlFactor:.2,phases:[]}});
    e.memory['combat:phaseSpeed']=1.4;
    expect(enemySpeedMultiplier(e,boss)).toBeCloseTo(1.12);
  });

  it('defers splitting when live capacity is full, then resumes from saved state',()=>{
    const child=enemy('child',{hp:10,bounty:1,layers:[{hp:10,cash:1,color:'red'}]});
    const parent=enemy('parent',{children:[{id:'child',count:2}]});
    const {config,state,spawn}=fixture([], [parent,child]);
    const origin=spawn('parent');
    for(let i=0;i<1800;i++)spawn('child',150);
    damageEnemy(state,config,origin.id,packet('x',1000));
    expect(state.enemies.filter(e=>e.defId==='child')).toHaveLength(1800);
    const pending=state.enemies.find(e=>e.id===origin.id);
    expect(pending?.memory['combat:child:0']).toBe(2);
    const restored=structuredClone(state);
    restored.enemies=restored.enemies.filter(e=>e.defId!=='child').concat(restored.enemies.filter(e=>e.defId==='child').slice(2));
    flushChildren(restored,config);
    expect(restored.enemies.filter(e=>e.defId==='child')).toHaveLength(1800);
    expect(restored.enemies.some(e=>e.id===origin.id)).toBe(false);
  });

  it('scales combo damage and strongest shred without letting visual events affect HP',()=>{
    const armored=enemy('armored',{armor:8});
    const {config,state,spawn}=fixture([], [armored]);
    const e=spawn('armored');
    e.statuses=[...['wet','mark','slow','shred'].map(kind=>({...status(kind as StatusKind,kind==='shred'?5:1,2),source:'t',remaining:2,stacks:1}))];
    damageEnemy(state,config,e.id,{...packet('x',10),element:'electric'});
    // 10 * 1.2 (wet/electric) * 1.1 (mark) - (8 - 5 shred) = 10.2
    expect(e.hp).toBeCloseTo(89.8,5);
    const snapshot=structuredClone(state);
    const visualEvents=structuredClone(state.events);
    visualEvents.push(...visualEvents);
    expect(snapshot.enemies[0].hp).toEqual(state.enemies[0].hp);
    expect(state.stats.damage).toBeCloseTo(10.2);
  });
});

describe('effects and active abilities',()=>{
  it('strongest aura wins, no recursion or self buff; support caps respected',()=>{
    const aura=tower('support','shot',[effect('aura',{id:'dam',stat:'damage',power:1}),effect('aura',{id:'speed',stat:'attackSpeed',power:1}),effect('aura',{id:'disc',stat:'discount',power:.9})]);
    const weapon=tower('gun');
    const {config,state}=fixture([aura,weapon]);
    const t1=placed('support','a'),t2=placed('support','b',2),gun=placed('gun','gun',5);
    state.towers.push(t1,t2,gun);
    expect(supportAt(state,config,gun)).toMatchObject({damage:.4,attackSpeed:.5,discount:.15});
    expect(supportAt(state,config,t1).damage).toBe(.4); // other support only
    state.towers=[t1];
    expect(supportAt(state,config,t1).damage).toBe(0);
  });

  it('charge, focus, trap, echo, copy, portal, barrier all execute with bounded state',()=>{
    const effects=[effect('charge',{power:1,cap:1,duration:.2}),effect('focus',{power:1,cap:1}),
      effect('trap',{power:10,interval:.2}),effect('echo',{power:.5,interval:.1,cap:2,radius:100}),
      effect('portal',{power:100,interval:.2}),effect('barrier',{power:2}),effect('copy',{power:.5,interval:.2})];
    const copied=tower('donor','shot',[],[],attack('shot',{damage:20}));
    const copier=tower('adapter','shot',effects,[],attack('shot',{damage:1,interval:2}));
    const {config,state,spawn}=fixture([copier,copied]);
    state.towers.push(placed('adapter','t1'),placed('donor','t2',30));
    const target=spawn();step(state,config,30);
    expect(state.lives).toBe(92);
    expect(state.stats.damage).toBeGreaterThan(30);
    expect(state.projectiles.length).toBeLessThan(100);
    expect(target.progress).toBeLessThan(80);
    expect(state.events.some(e=>e.visual==='echo:echo')).toBe(true);
  });

  it('copy never copies a copier, effects income/interest are only engine-owned at wave end',()=>{
    const copy=effect('copy',{power:1,radius:300,interval:.1});
    const d=tower('mirror','shot',[copy,effect('income',{power:100}),effect('interest',{power:.5,cap:500})],[],attack('shot',{damage:0}));
    const {config,state,spawn}=fixture([d]);
    state.towers.push(placed('mirror','m1'),placed('mirror','m2',20));spawn();
    step(state,config,30);
    expect(state.stats.damage).toBe(0);expect(state.credits).toBe(0);
    expect(state.projectiles).toHaveLength(0);
  });

  it('copy uses the nearest legal resolved donor attack without firing donor abilities',()=>{
    const copier=tower('mirror','shot',[effect('copy',{power:.5,radius:200,interval:.2})],[],attack('shot',{damage:0}));
    const donor=tower('donor','shot',[effect('portal',{power:100,interval:100})],[ability('mint')],attack('shot',{damage:40,interval:20}));
    const {config,state,spawn}=fixture([copier,donor]);
    state.towers.push(placed('mirror','m'),placed('donor','d',30));
    state.towers[1].cooldown=20;
    const target=spawn();
    step(state,config,25);
    expect(target.hp).toBeLessThan(100);
    expect(state.events.filter(e=>e.kind==='hit').map(e=>e.amount)).toEqual(expect.arrayContaining([20]));
    expect(state.events.filter(e=>e.kind==='hit').every(e=>e.amount===20)).toBe(true);
    expect(state.stats.abilities).toBe(0);
    expect(target.progress).toBe(80); // no portal effect copied
  });

  it('harvest cap and iron-oath blockade prevent money loops',()=>{
    const mint=tower('mint','pulse',[effect('harvest',{power:1,radius:300,cap:5})],[],attack('pulse',{damage:0}));
    const e=enemy('small',{hp:10,bounty:10,layers:[{hp:10,cash:10,color:'red'}]});
    for(const modeId of ['standard','iron-oath']){
      const {config,state,spawn}=fixture([mint],[e],{modeId});
      state.towers.push(placed('mint'));
      const one=spawn(),two=spawn();
      damageEnemy(state,config,one.id,packet('t1',100));
      damageEnemy(state,config,two.id,packet('t1',100));
      expect(state.credits).toBe(modeId==='iron-oath'?20:25);
      expect(state.towers[0].generated).toBe(modeId==='iron-oath'?0:5);
    }
  });

  it('barrier refreshes only once per wave, respects the one-life restriction',()=>{
    const d=tower('shield','shot',[effect('barrier',{power:7})],[],attack('shot',{damage:0}));
    const {config,state}=fixture([d]);state.towers.push(placed('shield'));
    step(state,config,2);
    expect(state.lives).toBe(97);
    step(state,config,2);
    expect(state.lives).toBe(97);
    state.wave=2;step(state,config);
    expect(state.lives).toBe(104);
    state.rules.maxLives=1;state.lives=1;state.wave=3;step(state,config);
    expect(state.lives).toBe(1);
  });

  it.each(['nova','meteor','overclock','rewind','barrier','mint'] as const)('%s activation checks cooldown and emits a single event',kind=>{
    const d=tower('ability','shot',[],[ability(kind)]);
    const {config,state,spawn}=fixture([d]);
    state.towers.push(placed('ability'));spawn();
    const first=combat.activate(state,config,'t1',kind);
    expect(first.ok).toBe(true);
    expect(combat.activate(state,config,'t1',kind).ok).toBe(false);
    expect(state.stats.abilities).toBe(1);
    expect(state.events.filter(e=>e.kind==='ability')).toHaveLength(1);
    if(kind==='mint')expect(state.credits).toBe(60);
    if(kind==='barrier')expect(state.lives).toBe(150>90?150:90); // power 60, capped at 150
  });

  it('iron-oath allows combat actives but rejects mint, and no-actives blocks all',()=>{
    const def=tower('ability','shot',[],[ability('nova'),ability('mint')]);
    const {config,state,spawn}=fixture([def],undefined,{modeId:'iron-oath',maxLives:1});
    state.lives=1;state.towers.push(placed('ability'));spawn();
    expect(combat.activate(state,config,'t1','nova').ok).toBe(true);
    expect(combat.activate(state,config,'t1','mint').ok).toBe(false);
    state.rules.allowAbilities=false;
    expect(combat.activate(state,config,'t1','nova').ok).toBe(false);
  });

  it.each<StatusKind>(['burn','poison','slow','freeze','stun','mark','shred','wet','reveal'])('%s status persists/refreshes at bounded duration',kind=>{
    const {config,state,spawn}=fixture();const e=spawn();
    damageEnemy(state,config,e.id,{...packet('t1',1),statuses:[status(kind,2,1,2)]});
    damageEnemy(state,config,e.id,{...packet('t1',1),statuses:[status(kind,2,1,2)]});
    expect(e.statuses.filter(s=>s.kind===kind)).toHaveLength(1);
    expect(e.statuses[0].remaining).toBeLessThanOrEqual(1);
    expect(e.statuses[0].stacks).toBeLessThanOrEqual(2);
  });

  it.each<EffectKind>(['aura','income','interest','charge','focus','deathBurst','copy','portal','barrier','harvest','trap','echo'])('%s effect resolves without changing its declarative value',kind=>{
    const original=effect(kind,{stat:kind==='aura'?'range':undefined});
    const def=tower('test','shot',[original]);
    const {config,state,spawn}=fixture([def]);
    state.towers.push(placed());spawn();
    step(state,config,15);
    expect(resolveTower(def,[0,0,0]).effects).toContainEqual(original);
    expect(def.effects[0]).toEqual(original);
  });
});
