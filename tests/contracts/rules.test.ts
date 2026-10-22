import {describe,it,expect} from 'vitest';
import {legalTiers,canUpgrade,sellRefund,upgradeCost} from '../../src/contracts/rules';
import type {Tiers,PathIndex} from '../../src/contracts';
describe('upgrade restrictions',()=>{
 it('allows all permutations of the full crosspath',()=>{
  for(const t of [[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]]) expect(legalTiers(t as Tiers)).toBe(true);
 });
 it('rejects two main paths, three paths, fractions and overflows',()=>{
  for(const t of [[3,3,0],[5,5,5],[1,1,1],[6,0,0],[-1,0,0],[1.5,0,0],[NaN,0,0]])expect(legalTiers(t as Tiers)).toBe(false);
 });
 it('checks every candidate in the complete finite upgrade space',()=>{
  for(let a=0;a<6;a++)for(let b=0;b<6;b++)for(let c=0;c<6;c++){
   const t:Tiers=[a,b,c];
   for(const p of [0,1,2] as PathIndex[]){
    const n:Tiers=[...t];n[p]++;
    expect(canUpgrade(t,p)).toBe(legalTiers(t)&&legalTiers(n));
   }
  }
 });
 it('does not allow a secondary path above two or a third path',()=>{
  expect(canUpgrade([5,2,0],1)).toBe(false);expect(canUpgrade([5,2,0],2)).toBe(false);
  expect(canUpgrade([2,2,0],0)).toBe(true);expect(canUpgrade([2,2,0],2)).toBe(false);
 });
});
describe('actual investment resale',()=>{
 it('always loses credits across cheap, expensive and upgraded towers',()=>{
  for(let n=1;n<100000;n+=37){expect(sellRefund(n)).toBe(Math.floor(n*.7));expect(sellRefund(n)).toBeLessThan(n);}
  expect(sellRefund(250+125+250+625+1500+3750+125+250)).toBe(4812);
 });
 it('rejects invalid investment',()=>{for(const n of [0,-1,NaN,Infinity,1.5])expect(()=>sellRefund(n)).toThrow();});
 it('uses incremental rounded upgrade prices',()=>{expect([1,2,3,4,5].map(t=>upgradeCost(250,1,t as 1|2|3|4|5))).toEqual([125,250,625,1500,3750]);});
});
