import { describe, expect, it } from 'vitest';
import { sweptContact,inSector,eventPointError, auditTrace,frame,type Trace } from '../../src/contact-validation/index';
import { cases, fixture, modes } from '../../src/contact-validation/fixtures';
const p=(x:number,y:number)=>({x,y});
describe('independent geometry',()=>{
 it('fast sweep crosses a circle with both ends outside',()=>{expect(sweptContact(p(0,0),p(1000,0),p(50,0),5)?.point).toEqual(p(45,0));});
 it('slow segment misses, tangent touches, zero-length overlap hits',()=>{expect(sweptContact(p(0,0),p(10,0),p(50,0),5)).toBeNull();expect(sweptContact(p(0,5),p(100,5),p(50,0),5)?.point).toEqual(p(50,5));expect(sweptContact(p(0,0),p(0,0),p(0,0),0)?.t).toBe(0);});
 it('transverse motion uses relative displacement',()=>{expect(sweptContact(p(0,0),p(100,0),p(50,-50),1,p(50,50))?.t).toBeCloseTo(.5-1/Math.sqrt(20000));expect(sweptContact(p(0,0),p(100,0),p(50,-50),1,p(50,-40))).toBeNull();});
 it('near tangent miss and reversed segment',()=>{expect(sweptContact(p(0,5.01),p(100,5.01),p(50,0),5)).toBeNull();expect(sweptContact(p(100,0),p(0,0),p(50,0),5)?.point).toEqual(p(55,0));});
 it('sector range and angle are independent',()=>{expect(inSector(p(0,0),p(1,0),p(10,0),10,60)).toBe(true);expect(inSector(p(0,0),p(1,0),p(11,0),10,60)).toBe(false);expect(inSector(p(0,0),p(1,0),p(0,5),10,60)).toBe(false);expect(inSector(p(0,0),p(1,0),p(-5,0),10,360)).toBe(true);});
 it('rejects nonfinite data',()=>{expect(()=>sweptContact(p(NaN,0),p(1,0),p(0,0),1)).toThrow();expect(()=>inSector(p(0,0),p(0,0),p(0,0),1,20)).toThrow();});
 it('checks real world point tolerance',()=>{const e={id:1,time:0,kind:'hit' as const,pos:p(50,10)};expect(eventPointError(e,p(50,0),10)).toBeNull();expect(eventPointError(e,p(50,0),9)).not.toBeNull();});
});
describe('trace checks',()=>{
 it('covers every attack mode with positive and negative cases',()=>{for(const m of modes){expect(cases.some(c=>c.attack.mode===m&&c.expected.length)).toBe(true);expect(cases.some(c=>c.attack.mode===m&&!c.expected.length)).toBe(true);}});
 it('detects missing contact, duplicate events and lost paid layer',()=>{const {config,state}=fixture(cases[0]);state.enemies[0].paidLayers=[0];const a=frame(state);state.tick=1;state.time=1/60;state.enemies[0].hp=80;state.enemies[0].paidLayers=[];const b=frame(state,[{id:1,time:state.time,kind:'income',amount:2},{id:1,time:state.time,kind:'income',amount:2}]);const t:Trace={version:1,name:'invalid',origin:'fixture',frames:[a,b],radii:{target:8},findings:[]};const errors=auditTrace(t,config).join(' ');expect(errors).toContain('without contact');expect(errors).toContain('duplicate event');expect(errors).toContain('lost paid layer');});
 it('accepts no damage before actual impact',()=>{const {config,state}=fixture(cases[0]);const a=frame(state);state.tick=1;state.time=1/60;const b=frame(state);state.tick=2;state.time=2/60;state.enemies[0].hp=75;const c=frame(state,[{id:1,time:state.time,kind:'hit',source:'t0',target:'e0',pos:p(160,100)}]);expect(auditTrace({version:1,name:'valid',origin:'fixture',frames:[a,b,c],radii:{target:8},findings:[]},config)).toEqual([]);});
});
