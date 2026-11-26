import {createHUD} from '../../../src/ui/hud';
import type {GameCommand, GameState, Tiers} from '../../../src/contracts';
import {makeConfig,makeState} from './fixture';

let state=makeState(),selected:string|null=null,placing:string|null=null;
const commands:GameCommand[]=[];
const config=makeConfig();
const update=()=>hud.update(state,selected,placing);
const hud=createHUD(document.querySelector<HTMLElement>('#hud')!,config,{
 playerId:'p1',isHost:true,
 chooseTower(id){placing=id;update();},
 select(id){selected=id;update();},
 exit(){},
 command(c){commands.push(c);return {ok:true,pending:true,requestId:String(commands.length)};}
});
const fixture={
 get state(){return state;},get selected(){return selected;},get placing(){return placing;},commands,
 select(id:string|null){selected=id;update();},
 tiers(t:Tiers){state=structuredClone(state);state.towers[0].tiers=t;update();},
 patch(p:Partial<GameState>){state={...state,...p};update();},
 refundMode(){state={...state,rules:{...state.rules,sellAllowed:false,maxLives:1}};update();},
 foreign(){state=structuredClone(state);state.options.players.push({id:'p2',name:'Гость',color:'#55aaff',connected:true});state.towers[0].owner='p2';update();},
 settle(id:string){hud.settle(id,{ok:false,reason:'Покупка отклонена'});},
 dispose(){hud.dispose();}
};
Object.assign(window,{hudFixture:fixture});
update();
