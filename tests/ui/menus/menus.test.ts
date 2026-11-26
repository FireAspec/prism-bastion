import {describe, expect, it} from 'vitest';
import type {DifficultyDef, GameConfig, ModeDef} from '../../../src/contracts';
import {menuRules} from '../../../src/ui/menus';
const difficulties: DifficultyDef[] = (['easy','normal','hard','extreme'] as const).map((id,i)=>({id,name:id,rounds:[40,60,80,100][i],lives:[200,150,100,1][i],startCredits:[1000,900,850,850][i],towerCostMul:[.85,1,1.1,1.2][i],enemyHpMul:[.85,1,1.1,1.2][i],roundRewardBase:[100,80,60,50][i],roundRewardStep:[5,4,3,2][i],popCashMul:1,rewardMul:[.7,1,1.35,1.7][i]}));
const config = {difficulties} as GameConfig;
const mode=(modifiers:ModeDef['modifiers']={}):ModeDef=>({id:'test',name:'test',description:'',requiresClear:false,modifiers});
describe('menu rules preview',()=>{
  it.each(difficulties)('preserves base $id',d=>{const r=menuRules(config,d.id,mode());expect(r).toMatchObject({rounds:d.rounds,maxLives:d.lives,towerCostMul:d.towerCostMul,roundRewardBase:d.roundRewardBase,roundRewardStep:d.roundRewardStep,startingCashMul:1,incomeMul:1});});
  it.each(difficulties)('one life does not change $id waves or prices',d=>{expect(menuRules(config,d.id,mode({maxLives:1}))).toMatchObject({maxLives:1,rounds:d.rounds,towerCostMul:d.towerCostMul});});
  it('applies only declared overrides without mutating input',()=>{const m=mode({startingCashMul:.5,incomeMul:.5});expect(menuRules(config,'hard',m)).toMatchObject({rounds:80,maxLives:100,startingCashMul:.5,incomeMul:.5});expect(menuRules(config,'hard',mode())?.incomeMul).toBe(1);expect(m.modifiers).toEqual({startingCashMul:.5,incomeMul:.5});});
  it('rejects missing difficulty data',()=>{expect(menuRules({difficulties:[]} as unknown as GameConfig,'normal',mode())).toBeUndefined();});
});
