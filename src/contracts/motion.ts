import type {Vec,GameState,GameEvent,Settings} from './index';
export interface MotionSample {offset:Vec;scale:number;rotation:number;glow:number;opacity:number;ghostAsset?:string;ghostOpacity?:number;}
export interface EntityMotion {
 consume(events:GameEvent[],state:GameState):void;
 update(realSeconds:number,state:GameState):void;
 sample(id:string):MotionSample;
 setReducedMotion(value:boolean):void;
 dispose():void;
}
export interface Timeline {
 advance(seconds:number):void;
 value(key:string,from:number,to:number,duration:number,ease?:'linear'|'outCubic'|'outBack'|'inOutCubic'):number;
 cancel(key:string):void;clear():void;
}
export type UITransition = 'purchase'|'reject'|'unlock'|'levelUp'|'reward'|'open'|'close'|'select'|'respec';
export interface UIMotion {play(element:HTMLElement,transition:UITransition):Promise<void>;setSettings(settings:Settings):void;dispose():void;}
