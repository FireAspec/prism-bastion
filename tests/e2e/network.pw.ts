import {test,expect} from '@playwright/test';
import {launch,Peer,converge,positions,ledger,assertPortClosed} from './wire';
import {requireModules,networkModules} from './preflight';
import {shortConfig} from './short-config';
import type {GameState,GameAction} from '../../src/contracts';

async function withRoom(count:2|4,short:boolean,body:(room:Awaited<ReturnType<typeof launch>>,peers:Peer[],welcomes:Awaited<ReturnType<Peer['join']>>[])=>Promise<void>){
  const room=await launch(count,short);
  const peers:Peer[]=[];
  const welcomes:Awaited<ReturnType<Peer['join']>>[]=[];
  try{
    for(let i=0;i<count;i++){
      const p=new Peer(room.url);peers.push(p);
      welcomes.push(await p.join(room.ready.digest,'QA '+i));
    }
    expect(new Set(welcomes.map(w=>w.playerId)).size).toBe(count);
    expect(new Set(welcomes.map(w=>w.resumeToken)).size).toBe(count);
    expect(welcomes[0].room.hostId).toBe(welcomes[0].playerId);
    await Promise.all(peers.map(p=>p.wait('room',m=>m.room.players.length===count)));
    await body(room,peers,welcomes);
  }finally{
    const cleanup=await Promise.allSettled(peers.map(p=>p.close()));
    await room.stop();
    await assertPortClosed(room.ready.port);
    for(const outcome of cleanup)if(outcome.status==='rejected')throw outcome.reason;
  }
}

for(const count of [2,4] as const){
  test(count+' clients: handshake, shared cash, simultaneous purchase, ownership, resume, host shutdown',async()=>{
    requireModules(networkModules);
    await withRoom(count,false,async(room,peers,welcomes)=>{
      const mismatch=new Peer(room.url);
      try{
        await mismatch.open();
        mismatch.send({type:'join',protocolVersion:1,contentDigest:room.ready.digest+'-different',name:'Mismatch',password:'qa-room'});
        expect((await mismatch.wait('error')).code).toBeTruthy();
        await mismatch.waitClosed();
        expect(mismatch.frames.some(f=>f.type==='welcome')).toBe(false);
      }finally{await mismatch.close();}
      const [host,guest]=peers;
      guest.send({type:'start'});
      await guest.wait('error');
      host.send({type:'start'});
      const initial=await converge(peers,s=>s.options.players.length===count&&s.phase==='build');
      expect(initial.credits).toBe(Math.floor(900*(count===2?1.25:1.75)));
      const slots=positions(room.ready.map,room.ready.tower);
      const price=room.ready.tower.cost;
      expect(price).toBeGreaterThan(0);
      expect(slots.length).toBeGreaterThan(Math.floor(initial.credits/price)+2);
      let s:GameState=initial,index=0;
      // Spend through actual commands, not by editing the wallet.
      while(s.credits>=2*price){
        const before=s.credits;
        const result=await host.command({type:'place',tower:room.ready.tower.id,pos:slots[index++]});
        expect(result.ok,result.reason).toBe(true);
        s=await converge(peers,x=>x.credits===before-price&&x.towers.length===index);
      }
      expect(s.credits).toBeGreaterThanOrEqual(price);
      expect(s.credits).toBeLessThan(2*price);
      const before=s.credits,towerCount=s.towers.length;
      const results=await Promise.all([host.command({type:'place',tower:room.ready.tower.id,pos:slots[index++]}),
        guest.command({type:'place',tower:room.ready.tower.id,pos:slots[index++]})]);
      expect(results.filter(r=>r.ok)).toHaveLength(1);
      s=await converge(peers,x=>x.credits===before-price&&x.towers.length===towerCount+1);
      const winning=s.towers.find(t=>t.id===results.find(r=>r.ok)?.entity);
      expect(winning).toBeDefined();
      expect(winning!.owner).toBe(welcomes[results[0].ok?0:1].playerId);
      const other=results[0].ok?guest:host;
      for(const action of [{type:'sell',tower:winning!.id},{type:'upgrade',tower:winning!.id,path:0},{type:'target',tower:winning!.id,targeting:'last'}] as GameAction[]){
        const result=await other.command(action);
        expect(result.ok).toBe(false);
      }
      expect((await guest.command({type:'pause',value:true})).ok).toBe(false);
      // A repeated command cannot execute later even after money is restored.
      const seller=results[0].ok?host:guest;
      const sold=await seller.command({type:'sell',tower:winning!.id});
      expect(sold.ok).toBe(true);
      const afterSell=s.credits+Math.floor(winning!.invested*0.7);
      s=await converge(peers,x=>x.credits===afterSell&&x.towers.length===towerCount);
      const from=seller.frames.length;
      seller.send({type:'command',seq:seller.seq,command:{type:'sell',tower:winning!.id}});
      expect((await seller.wait('result',m=>m.seq===seller.seq,from)).result.ok).toBe(false);
      const fresh=await seller.wait('snapshot',()=>true,from);
      expect(ledger(fresh.state)).toEqual(ledger(s));
      const oldId=welcomes[1].playerId,oldToken=welcomes[1].resumeToken,oldSeq=guest.seq;
      await guest.close();
      await host.wait('room',m=>m.room.players.some(p=>p.id===oldId&&!p.connected));
      const resumed=new Peer(room.url);peers[1]=resumed;
      const welcome=await resumed.join(room.ready.digest,'QA 1',oldToken);
      expect(welcome.playerId).toBe(oldId);
      resumed.seq=oldSeq;
      const synced=await converge(peers,x=>x.credits===afterSell&&x.towers.length===towerCount&&x.options.players.every(p=>p.connected));
      expect(ledger(synced)).toEqual(ledger(s));
      const pongAt=Date.now();resumed.send({type:'ping',at:pongAt});
      expect((await resumed.wait('pong',m=>m.at===pongAt)).at).toBe(pongAt);
      await room.stop();
      await Promise.all(peers.map(p=>p.waitClosed()));
    });
  });
}

class MemoryStorage implements Storage {
  private data=new Map<string,string>();
  get length(){return this.data.size;}
  clear(){this.data.clear();}
  getItem(key:string){return this.data.get(key)??null;}
  key(index:number){return [...this.data.keys()][index]??null;}
  removeItem(key:string){this.data.delete(key);}
  setItem(key:string,value:string){this.data.set(key,String(value));}
}

test('terminal result re-delivery after resume cannot duplicate persistent rewards',async()=>{
  requireModules([...networkModules,'src/progression/index.ts','src/persistence/index.ts']);
  const [{loadContent},{createProgression},{createSaveStore,defaultProfile}]=await Promise.all([
    import('../../src/content'),import('../../src/progression'),import('../../src/persistence')
  ]);
  const config=shortConfig(loadContent()),progression=createProgression(config);
  await withRoom(2,true,async(room,peers,welcomes)=>{
    const [host,guest]=peers;
    host.send({type:'start'});
    await converge(peers,s=>s.phase==='build');
    expect((await host.command({type:'startWave'})).ok).toBe(true);
    const results=await Promise.all(peers.map(p=>p.wait('runResult')));
    expect(results[0].result.runId).toBe(results[1].result.runId);
    for(const {result} of results){expect(result.won).toBe(true);expect(result.eligible).toBe(true);expect(result.rounds).toBe(1);}
    const storage=new MemoryStorage(),store=createSaveStore(storage);
    const first=progression.reward(defaultProfile(),results[1].result);
    expect(first.receipt.duplicate).toBe(false);
    expect(first.receipt.xp).toBeGreaterThan(0);
    store.save({version:1,savedAt:new Date().toISOString(),contentVersion:config.contentVersion,profile:first.profile,run:null});
    await guest.close();
    await host.wait('room',m=>m.room.players.some(p=>p.id===welcomes[1].playerId&&!p.connected));
    const resumed=new Peer(room.url);peers[1]=resumed;
    expect((await resumed.join(room.ready.digest,'QA 1',welcomes[1].resumeToken)).playerId).toBe(welcomes[1].playerId);
    const replayed=(await resumed.wait('runResult')).result;
    expect(replayed).toEqual(results[1].result);
    const loaded=createSaveStore(storage).load().profile;
    const second=progression.reward(loaded,replayed);
    expect(second.receipt.duplicate).toBe(true);
    expect(second.receipt.xp).toBe(0);
    expect(second.receipt.seals).toBe(0);
    expect(second.profile).toEqual(loaded);
  });
});
