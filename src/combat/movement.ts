import type {EnemyDef,EnemyState} from '../contracts';

/** Movement adapter for the engine: combat does not advance path progress itself. */
export function enemySpeedMultiplier(enemy:EnemyState,def:EnemyDef):number {
  if(enemy.hp<=0)return 0;
  const slow=enemy.statuses.filter(s=>s.kind==='slow'&&s.remaining>0).reduce((max,s)=>Math.max(max,s.power),0);
  const hard=enemy.statuses.some(s=>(s.kind==='freeze'||s.kind==='stun')&&s.remaining>0);
  const control=def.boss?Math.max(.15,Math.min(1,def.boss.controlFactor)):1;
  const slowFactor=Math.max(.25,1-Math.max(0,slow)*control);
  const controlFactor=hard?(def.boss?Math.max(.15,1-control):0):1;
  const phase=def.boss?Math.max(.1,enemy.memory['combat:phaseSpeed']??1):1;
  const spawnSpeed=Math.max(.01,enemy.memory.speedMul??1);
  return Math.max(0,slowFactor*controlFactor*phase*spawnSpeed);
}
