import type {AttackDef,EffectDef,AbilityDef,PathIndex,ResolvedTower,StatDelta,Tiers,TowerDef,StatusSpec} from '../contracts';
import {legalTiers} from '../contracts/rules';

const copy = <T>(value:T):T => structuredClone(value);

function combineStatuses(current:StatusSpec[], incoming:StatusSpec[]):StatusSpec[] {
  const map=new Map(current.map(status=>[status.kind,copy(status)]));
  for(const status of incoming){
    const prior=map.get(status.kind);
    map.set(status.kind,prior?{
      kind:status.kind,power:Math.max(prior.power,status.power),
      duration:Math.max(prior.duration,status.duration),
      maxStacks:Math.max(prior.maxStacks??1,status.maxStacks??1)
    }:copy(status));
  }
  return [...map.values()];
}

function deltaAttack(a:AttackDef,d:StatDelta):void {
  a.damage*=d.damageMul??1;
  a.interval=Math.max(.05,a.interval*(d.intervalMul??1));
  a.range*=d.rangeMul??1;
  a.pierce=Math.max(1,a.pierce+(d.pierceAdd??0));
  a.count=Math.max(1,a.count+(d.countAdd??0));
  a.splash=Math.max(0,a.splash+(d.splashAdd??0));
  a.chains=Math.max(0,a.chains+(d.chainsAdd??0));
  a.chainRadius=Math.max(0,a.chainRadius+(d.chainRadiusAdd??0));
  a.armorPierce+=d.armorPierceAdd??0;
  a.shieldMultiplier*=d.shieldMultiplierMul??1;
  a.bossMultiplier*=d.bossMultiplierMul??1;
  a.executeBelow=Math.min(1,Math.max(0,a.executeBelow+(d.executeBelowAdd??0)));
  a.push+=d.pushAdd??0;
  a.detects ||= d.detects??false;
  a.projectileSpeed*=d.projectileSpeedMul??1;
  a.windup=Math.max(0,a.windup*(d.windupMul??1));
  a.arc+=d.arcAdd??0;
}

/** Resolve pure content data, never mutating a tower catalog object. */
export function resolveTower(def:TowerDef,tiers:Tiers):ResolvedTower {
  if(!legalTiers(tiers))throw new RangeError(`Invalid upgrade combination ${tiers.join('-')}`);
  const selected=([0,1,2] as PathIndex[]).filter(i=>tiers[i]>0);
  const primary=selected.sort((a,b)=>tiers[b]-tiers[a]||a-b)[0];
  const attack=copy(def.attack);
  const effects=new Map<string,EffectDef>(def.effects.map(e=>[e.id,copy(e)]));
  const abilities=new Map<string,AbilityDef>(def.abilities.map(a=>[a.id,copy(a)]));
  // Only the main specialization controls attack geometry at T3+.
  if(primary!==undefined && tiers[primary]>=3){
    for(let tier=3;tier<=tiers[primary];tier++){
      const replacement=def.paths[primary].upgrades[tier-1]?.replaceAttack;
      if(replacement)Object.assign(attack,copy(replacement));
    }
  }
  for(const path of [0,1,2] as const){
    for(let tier=1;tier<=tiers[path];tier++){
      const upgrade=def.paths[path].upgrades[tier-1];
      if(!upgrade)throw new RangeError(`Missing upgrade ${def.id}:${path}:${tier}`);
      deltaAttack(attack,upgrade.delta);
      if(upgrade.addStatuses)attack.statuses=combineStatuses(attack.statuses,upgrade.addStatuses);
      for(const effect of upgrade.effects??[])effects.set(effect.id,copy(effect));
      for(const ability of upgrade.abilities??[])abilities.set(ability.id,copy(ability));
    }
  }
  const visual=primary===undefined?copy(def.visual):copy(def.paths[primary].upgrades[tiers[primary]-1].visual);
  const secondary=selected.find(p=>p!==primary);
  return {attack,effects:[...effects.values()],abilities:[...abilities.values()],visual,
    ...(primary===undefined?{}:{mainPath:primary}),
    ...(secondary===undefined?{}:{secondaryOverlay:def.paths[secondary].upgrades[tiers[secondary]-1].visual.asset})};
}
