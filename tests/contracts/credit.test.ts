import {it,expect} from 'vitest';
import {credit} from '../../src/contracts/runtime';
import type {GameState} from '../../src/contracts';
it('retains half-credit layer payments across snapshots without paying twice',()=>{
 // This fixture contains exactly the fields used by the isolated accounting helper.
 const state={credits:0,time:0,nextEvent:1,events:[],stats:{earned:0,cashSubunits:0}} as unknown as GameState;
 expect(credit(state,.5)).toBe(0);
 expect(state.credits).toBe(0);expect(state.stats.cashSubunits).toBe(50);
 const restored=JSON.parse(JSON.stringify(state)) as GameState;
 expect(credit(restored,.5)).toBe(1);
 expect(restored.credits).toBe(1);expect(restored.stats.cashSubunits).toBe(0);
 expect(restored.events).toHaveLength(1);expect(restored.events[0].amount).toBe(1);
 expect(credit(restored,1.25)).toBe(1);expect(restored.stats.cashSubunits).toBe(25);
 expect(()=>credit(restored,-1)).toThrow();expect(()=>credit(restored,Infinity)).toThrow();
});
