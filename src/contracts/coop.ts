import type {HostOptions,RunOptions,RoomState,GameEngine,GameConfig,Profile,CampaignNode,ModeDef} from './index';
export interface HostHandle {port:number;address:string;invite:string;room():RoomState;stop():Promise<void>;}
export interface HostDependencies {
 config:GameConfig;
 createEngine:(options:RunOptions)=>GameEngine;
}
export interface CampaignService {
 nodes:CampaignNode[];
 availableMaps(profile:Profile):string[];
 availableTowers(profile:Profile):string[];
 complete(profile:Profile,mapId:string,modeId:string,victory:boolean):Profile;
}
export interface ContentManifest {version:string;protocol:1;schema:1;towers:string[];maps:string[];modes:string[];}
export interface BalanceSummary {map:string;mode:string;seed:number;won:boolean;wave:number;lives:number;credits:number;strategy:string;}
export type ModeCatalog = ModeDef[];
export type HostFactory = (options:HostOptions,run:RunOptions,dependencies:HostDependencies)=>Promise<HostHandle>;
