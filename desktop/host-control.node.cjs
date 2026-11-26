'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateStart,addresses,createHostController}=require('./host-control.cjs');
const o={port:43127,name:'Комната',password:'',maxPlayers:2};
const r={mapId:'lantern-garden',difficulty:'easy',seed:12,endless:false,modeId:'standard',unlockedTowers:['needle'],players:[{id:'host',name:'Игрок',color:'#fff',connected:true}],runId:'run-1',knowledge:[]};
test('strict payload and limits',()=>{
 validateStart(o,r);
 for(const bad of [{...o,port:80},{...o,maxPlayers:5},{...o,extra:true},{...o,password:'x'.repeat(129)}])assert.throws(()=>validateStart(bad,r));
 for(const bad of [{...r,seed:NaN},{...r,players:[]},{...r,unlockedTowers:['needle','needle']},{...r,knowledge:['../file']}])assert.throws(()=>validateStart(o,bad));
});
test('addresses include local IPv4 only and deduplicate',()=>{
 assert.deepEqual(addresses({a:[{internal:false,family:'IPv4',address:'192.168.0.2'},{internal:false,family:'IPv6',address:'::1'}],b:[{internal:false,family:4,address:'192.168.0.2'}]}),['127.0.0.1','192.168.0.2']);
});
test('serialize starts and stops; do not expose host handle',async()=>{
 let stopped=0;
 const c=createHostController(async()=>({address:'127.0.0.1',port:43127,invite:'test',room(){},async stop(){stopped++;}}));
 const first=c.start(o,r), second=c.start(o,r);
 await assert.rejects(second,/already running/);
 assert.deepEqual(await first,{address:'127.0.0.1',port:43127,invite:'test'});
 await c.stop();await c.stop();assert.equal(stopped,1);
 await c.start(o,r);await c.close();assert.equal(stopped,2);
 await assert.rejects(c.start(o,r),/closing/);
});
test('close during startup closes newly acquired host',async()=>{
 let resolve,stopped=0;
 const c=createHostController(()=>new Promise(r=>{resolve=r;}));
 const start=c.start(o,r);await Promise.resolve();
 const closing=c.close();resolve({async stop(){stopped++;}});
 await assert.rejects(start,/closing/);await closing;assert.equal(stopped,1);
});
test('failed startup allows retry',async()=>{
 let calls=0;
 const c=createHostController(async()=>{if(!calls++)throw Error('EADDRINUSE');return {port:43127,address:'localhost',invite:'test',async stop(){}};});
 await assert.rejects(c.start(o,r),/EADDRINUSE/);
 assert.equal((await c.start(o,r)).port,43127);await c.close();
});
