import type {Tiers, PathIndex} from './index';
export function legalTiers(t:Tiers):boolean {
 return t.every(n=>Number.isInteger(n)&&n>=0&&n<=5)&&t.filter(n=>n>0).length<=2&&t.filter(n=>n>2).length<=1;
}
export function canUpgrade(t:Tiers,p:PathIndex):boolean {
 const next:Tiers=[...t]; next[p]++; return legalTiers(t)&&legalTiers(next);
}
export function sellRefund(invested:number):number {
 if(!Number.isSafeInteger(invested)||invested<=0)throw new RangeError('Investment must be a positive safe integer');
 return Math.floor(invested*0.7);
}
export const tierCostMultipliers = [0.5,1,2.5,6,15] as const;
export function upgradeCost(base:number,pathFactor:number,tier:1|2|3|4|5):number {
 return Math.ceil(base*pathFactor*tierCostMultipliers[tier-1]/5)*5;
}
