import {startHost} from '../../src/network/host';
import {loadContent} from '../../src/content';
import {createGame} from '../../src/engine';
import {createCombat} from '../../src/combat';
import {shortConfig} from './short-config';
import type {RunOptions} from '../../src/contracts';
import type {HostHandle} from '../../src/contracts/coop';

let host:HostHandle|undefined;
let closing=false;
async function close(){
  if(closing)return;
  closing=true;
  try{await host?.stop();process.exit(0);}catch(e){console.error(e);process.exit(1);}
}
process.on('message',m=>{if(m==='stop')void close();});
process.on('disconnect',()=>void close());
process.on('SIGTERM',()=>void close());
process.on('SIGINT',()=>void close());

async function main(){
  const count=Number(process.argv[2]);
  if(count!==2&&count!==4)throw new Error('Expected 2 or 4 players');
  const short=process.argv[3]==='short';
  const source=loadContent();
  const config=short?shortConfig(source):source;
  const options:RunOptions={mapId:'lantern-garden',difficulty:'normal',seed:7217,endless:false,modeId:'standard',
    unlockedTowers:['needle','cannon','frost','beacon'],players:[{id:'qa-host',name:'Host',color:'#ffcc66',connected:true}],
    runId:'qa-'+process.pid+'-'+Date.now(),knowledge:[]};
  host=await startHost({port:0,name:'QA room',maxPlayers:count,password:'qa-room'},options,{
    config,createEngine:run=>createGame(config,run,createCombat())
  });
  const map=config.maps.find(m=>m.id===options.mapId);
  const tower=config.towers.find(t=>t.id==='needle');
  if(!map||!tower)throw new Error('Missing initial content');
  process.send?.({type:'ready',port:host.port,digest:config.contentDigest,map,tower});
}
main().catch(async e=>{console.error(e);try{await host?.stop();}finally{process.exit(1);}});
