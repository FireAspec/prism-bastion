'use strict';
const {networkInterfaces}=require('node:os');
function requireValid(ok){if(!ok)throw new TypeError('Invalid desktop request');}
const record=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const str=(x,n,min=1)=>typeof x==='string'&&x.length>=min&&x.length<=n&&!/[\x00-\x1f\x7f]/.test(x);
const id=x=>str(x,128)&&/^[a-zA-Z0-9_.:-]+$/.test(x);
const ids=(x,max)=>Array.isArray(x)&&x.length<=max&&x.every(id)&&new Set(x).size===x.length;
function validateStart(o,r){
  requireValid(record(o,['port','name','maxPlayers','password'])&&Number.isInteger(o.port)&&o.port>=1024&&o.port<=65535&&str(o.name,24)&&[2,3,4].includes(o.maxPlayers)&&str(o.password,128,0));
  requireValid(record(r,['mapId','difficulty','seed','endless','modeId','unlockedTowers','players','runId','knowledge'])&&id(r.mapId)&&id(r.modeId)&&id(r.runId)&&['easy','normal','hard','extreme'].includes(r.difficulty)&&Number.isSafeInteger(r.seed)&&typeof r.endless==='boolean'&&ids(r.unlockedTowers,30)&&ids(r.knowledge,150));
  requireValid(Array.isArray(r.players)&&r.players.length>=1&&r.players.length<=o.maxPlayers&&r.players.every(p=>record(p,['id','name','color','connected'])&&id(p.id)&&str(p.name,24)&&str(p.color,32)&&typeof p.connected==='boolean')&&new Set(r.players.map(p=>p.id)).size===r.players.length);
}
function addresses(interfaces=networkInterfaces()){
  return [...new Set(['127.0.0.1',...Object.values(interfaces).flatMap(a=>a||[]).filter(a=>!a.internal&&(a.family==='IPv4'||a.family===4)).map(a=>a.address)])];
}
function createHostController(factory){
  let current=null, queue=Promise.resolve(), closed=false;
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  async function stopCurrent(){if(current){await current.stop();current=null;}}
  return {
    start(o,r){validateStart(o,r);return serial(async()=>{
      if(closed)throw new Error('Application is closing');
      if(current)throw new Error('A room is already running');
      current=await factory(o,r);
      if(closed){await stopCurrent();throw new Error('Application is closing');}
      const {address,port,invite}=current;
      return {address,port,invite};
    });},
    stop(){return serial(stopCurrent);},
    close(){closed=true;return serial(stopCurrent);}
  };
}
module.exports={validateStart,addresses,createHostController};
