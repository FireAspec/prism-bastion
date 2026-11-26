import {describe,expect,it} from 'vitest';
import {hudPrice,resolveHUDTower,towerAsset,upgradeBlock} from '../../../src/ui/hud';
import {sellRefund} from '../../../src/contracts/rules';
import type {PathIndex,Tiers} from '../../../src/contracts';
import {makeConfig,makeDef,makeState,makeTower} from './fixture';

describe('HUD projection and transaction preview',()=>{
 it('selects the full T5 model and actual T2 overlay in all six crosspaths for every tower',()=>{
  for(const def of makeConfig().towers)for(const main of [0,1,2] as PathIndex[])for(const secondary of [0,1,2] as PathIndex[]){
   if(main===secondary)continue;
   const tiers:Tiers=[0,0,0];tiers[main]=5;tiers[secondary]=2;
   const model=resolveHUDTower(def,tiers);
   expect(model.mainPath).toBe(main);
   expect(model.visual.asset).toBe('abc'[main]+'5.svg');
   expect(model.secondaryOverlay).toBe('/art/towers/'+def.id+'/'+'abc'[secondary]+'2-overlay.svg');
   expect(model.attack.mode).toBe('beam');
   expect(model.attack.damage).toBe(100*(main+1)*128);
   expect(def.attack.damage).toBe(10);
  }
 });
 it('chooses the lower index on a tie and uses local model paths',()=>{
  const def=makeDef();
  expect(resolveHUDTower(def,[0,2,2]).visual.asset).toBe('b2.svg');
  expect(towerAsset('needle','public/art/towers/needle/a5.svg')).toBe('/art/towers/needle/a5.svg');
  expect(towerAsset('needle','https://example.com/a5.svg')).toBe('/art/towers/needle/base.svg');
 });
 it('never permits the third path or a second T3, including invalid snapshots',()=>{
  const s=makeState();const t=s.towers[0];
  t.tiers=[1,1,0];expect(upgradeBlock(s,t,2)).toBe('crosspath');
  t.tiers=[3,2,0];expect(upgradeBlock(s,t,1)).toBe('crosspath');
  expect(()=>resolveHUDTower(makeDef(),[1,1,1])).toThrow();
  expect(()=>resolveHUDTower(makeDef(),[3,3,0])).toThrow();
 });
 it('enforces owner, team T5 and low-tech independently',()=>{
  const s=makeState();const t=s.towers[0];t.tiers=[4,2,0];
  expect(upgradeBlock(s,t,0,'p2')).toBe('owner');
  const other=makeTower('needle','t2');other.tiers=[5,0,0];s.towers.push(other);
  expect(upgradeBlock(s,t,0,'p1')).toBe('teamTier');
  s.towers.pop();expect(upgradeBlock(s,t,0,'p1')).toBe('');
  s.rules.maxTier=3;expect(upgradeBlock(s,t,0,'p1')).toBe('modeTier');
 });
 it('uses strongest eligible support, excludes self, and caps total discount',()=>{
  const c=makeConfig(),s=makeState(),t=s.towers[0];
  const forge=c.towers.find(d=>d.id==='forge')!;
  forge.effects=[{id:'discount',kind:'aura',stat:'discount',power:.15,radius:50,interval:1,duration:0,cap:0}];
  const f=makeTower('forge','f');f.pos={x:149,y:100};s.towers.push(f);
  expect(hudPrice(c,s,100,t)).toBe(88);
  expect(hudPrice(c,s,100,f)).toBe(102);
  f.pos.x=151;expect(hudPrice(c,s,100,t)).toBe(102);
  s.rules.allowKnowledge=false;expect(hudPrice(c,s,100,t)).toBe(110);
  expect(sellRefund(251)).toBe(175);
 });
 it('leaves definitions and state unchanged',()=>{
  const c=makeConfig(),s=makeState();const before=JSON.stringify({c,s});
  resolveHUDTower(c.towers[0],[5,2,0]);hudPrice(c,s,100,s.towers[0]);
  expect(JSON.stringify({c,s})).toBe(before);
 });
});
