import {it,expect} from 'vitest';
import {loadContent} from '../../src/content';
import {createProgression} from '../../src/progression';
import type {GameConfig,KnowledgeStat,TowerDef,AttackDef} from '../../src/contracts';
import {profile,seed} from './fixtures';

function attacks(t:TowerDef):AttackDef[]{
 return [t.attack,...t.paths.flatMap(p=>p.upgrades.flatMap(u=>u.replaceAttack?[u.replaceAttack]:[]))];
}
function projection(c:GameConfig,stat:KnowledgeStat,scope?:string[]):number[]{
 const ts=c.towers.filter(t=>!scope||scope.includes(t.id));
 const w=ts.filter(t=>t.category==='weapon'||t.category==='tech');
 const e=ts.filter(t=>t.category==='element');
 const water=ts.filter(t=>t.category==='water');
 const effects=ts.flatMap(t=>[...t.effects,...t.paths.flatMap(p=>p.upgrades.flatMap(u=>u.effects??[]))]);
 switch(stat){
  case 'weaponDamage':return w.flatMap(attacks).map(a=>a.damage);
  case 'weaponSpeed':return w.flatMap(attacks).map(a=>a.interval);
  case 'weaponRange':return w.flatMap(attacks).map(a=>a.range);
  case 'elementDamage':return e.flatMap(attacks).map(a=>a.damage);
  case 'waterDamage':return water.flatMap(attacks).map(a=>a.damage);
  case 'waterRange':return water.flatMap(attacks).map(a=>a.range);
  case 'shieldDamage':return ts.flatMap(attacks).map(a=>a.shieldMultiplier);
  case 'bossDamage':return ts.flatMap(attacks).map(a=>a.bossMultiplier);
  case 'statusDuration':case 'controlDuration':{
   const control=stat==='controlDuration';
   return ts.flatMap(t=>[...attacks(t).flatMap(a=>a.statuses),...t.paths.flatMap(p=>p.upgrades.flatMap(u=>u.addStatuses??[])),...t.effects.flatMap(e=>e.status?[e.status]:[])]).filter(s=>control?['freeze','stun'].includes(s.kind):!['freeze','stun','shred'].includes(s.kind)).map(s=>s.duration);
  }
  case 'supportRadius':return effects.filter(e=>e.kind==='aura').map(e=>e.radius);
  case 'revealRadius':return effects.filter(e=>e.kind==='aura'&&e.stat==='detect').map(e=>e.radius);
  case 'abilityCooldown':return ts.flatMap(t=>[...t.abilities,...t.paths.flatMap(p=>p.upgrades.flatMap(u=>u.abilities??[]))]).map(a=>a.cooldown);
  case 'passiveIncome':return effects.filter(e=>['income','interest','harvest'].includes(e.kind)).map(e=>e.power);
  case 'purchaseDiscount':return [c.knowledgeDiscount];
  case 'startingCash':return c.difficulties.map(d=>d.startCredits);
  case 'lives':return c.difficulties.map(d=>d.lives);
  case 'xpGain':case 'sealGain':return [];
 }
}
it('each of the 150 actual nodes changes its declared gameplay or reward channels',()=>{
 const c=loadContent();expect(c.knowledge).toHaveLength(150);
 // Amplify rewards to observe even a small fractional meta bonus after integer rounding.
 const config:GameConfig={...c,economy:{...c.economy,mapXP:[100000,100000,100000,100000],mapSeals:[100000,100000,100000,100000]}};
 const progression=createProgression(config);
 for(const n of c.knowledge){
  const after=progression.applyKnowledge(config,[n.id],'standard');
  for(const e of n.effects){
   const label=n.id+' '+e.stat;
   if(e.stat==='xpGain'||e.stat==='sealGain'){
    const run={runId:'qa-node-'+n.id,mapId:c.maps[0].id,modeId:'standard',won:true,wave:60,rounds:60,seed,eligible:true,durationSeconds:720,contentDigest:c.contentDigest,difficulty:'normal' as const};
    const before=progression.reward(profile(),run).receipt;
    const boosted=progression.reward({...profile(),knowledgeUnlocked:[n.id]},run).receipt;
    expect(e.stat==='xpGain'?boosted.xp:boosted.seals,label).toBeGreaterThan(e.stat==='xpGain'?before.xp:before.seals);
   }else{
    const before=projection(config,e.stat,e.towers),changed=projection(after,e.stat,e.towers);
    expect(before.length,label).toBeGreaterThan(0);expect(changed.length,label).toBe(before.length);
    const lower=e.stat==='weaponSpeed'||e.stat==='abilityCooldown';
    expect(changed.some((v,i)=>lower?v<before[i]:v>before[i]),label).toBe(true);
    expect(changed.every((v,i)=>lower?v<=before[i]:v>=before[i]),label).toBe(true);
   }
  }
 }
},60000);
