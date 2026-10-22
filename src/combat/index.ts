import type {CombatModule} from '../contracts';
import {resolveTower} from './resolve';
import {applyStatusTick,damageEnemy,flushChildren} from './damage';
import {activate,stepOrdnance,stepTowers,supportAt} from './attack';
import {enemySpeedMultiplier} from './movement';

/** One deterministic simulation step. The engine owns movement, leaks and wave money. */
export function createCombat():CombatModule {
  return {
    resolveTower,
    step(state,config,dt){
      if(state.phase!=='wave'||state.paused||!Number.isFinite(dt)||dt<=0)return;
      applyStatusTick(state,config,dt);
      stepOrdnance(state,config,dt);
      stepTowers(state,config,dt);
      flushChildren(state,config);
    },
    activate
  };
}

export {damageEnemy,resolveTower,supportAt,enemySpeedMultiplier};
