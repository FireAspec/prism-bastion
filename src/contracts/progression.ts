import type {Profile,GameConfig,KnowledgeNode,RunResult,RewardReceipt} from './index';
export interface ProgressionService {
 xpToNext(level:number):number;
 buy(profile:Profile,nodeId:string):{profile:Profile;ok:boolean;reason?:string};
 respec(profile:Profile):{profile:Profile;ok:boolean;reason?:string};
 reward(profile:Profile,result:RunResult):{profile:Profile;receipt:RewardReceipt};
 applyKnowledge(config:GameConfig,nodeIds:string[],modeId:string):GameConfig;
 combineKnowledge(loadouts:string[][],modeId:string):string[];
 validateCatalog(nodes:KnowledgeNode[]):string[];
}
export interface KnowledgeHooks {buy:(id:string)=>void;respec:()=>void;close:()=>void;}
