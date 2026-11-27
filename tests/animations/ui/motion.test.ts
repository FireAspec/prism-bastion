import {test,expect} from 'vitest';
import {createUIMotion} from '../../../src/ui-motion';
import type {Settings} from '../../../src/contracts';
const settings:Settings={reducedMotion:false,quality:'high',colorblind:false,master:1,music:1,sfx:1,language:'ru',fullscreen:false};
function fixture(){let resolve!:()=>void;let reject!:(e:Error)=>void;const finished=new Promise<void>((r,j)=>{resolve=r;reject=j;});let cancelled=0;const element={isConnected:true,ownerDocument:{},animate:()=>({finished,cancel:()=>{cancelled++;reject(new Error('cancel'));}})} as unknown as HTMLElement;return{element,resolve,get cancelled(){return cancelled;}};}
test('reduced motion skips animations and cancels existing promises',async()=>{const motion=createUIMotion(settings),f=fixture();const pending=motion.play(f.element,'purchase');motion.setSettings({...settings,reducedMotion:true});await pending;expect(f.cancelled).toBe(1);await motion.play(f.element,'reward');expect(f.cancelled).toBe(1);motion.dispose();});
test('cancel settles promises',async()=>{const motion=createUIMotion(settings),f=fixture();const pending=motion.play(f.element,'open');motion.cancel(f.element);await pending;expect(f.cancelled).toBe(1);motion.dispose();});
test('ordinary completion does not cancel the finished animation',async()=>{const motion=createUIMotion(settings),f=fixture();const pending=motion.play(f.element,'unlock');f.resolve();await pending;motion.dispose();expect(f.cancelled).toBe(0);});
