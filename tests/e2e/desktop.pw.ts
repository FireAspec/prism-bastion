import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {requireModules,appModules,networkModules,unavailable} from './preflight';
import {bounded,Peer,assertPortClosed} from './wire';

async function freePort(){
  const server=createServer();
  try{
    await bounded(new Promise<void>((res,rej)=>{server.once('error',rej);server.listen(0,'127.0.0.1',()=>res());}),5000);
    const address=server.address();
    if(!address||typeof address==='string')throw new Error('No port');
    return address.port;
  }finally{if(server.listening)await bounded(new Promise<void>((res,rej)=>server.close(e=>e?rej(e):res())),5000);}
}
test('Windows Electron hosts through actual preload/IPC and releases listening port',async({},info)=>{
  if(process.platform!=='win32'){unavailable('Requires Windows Electron runner');return;}
  const entry=process.env.PB_E2E_ELECTRON_ENTRY;
  if(!entry){unavailable('Set PB_E2E_ELECTRON_ENTRY to built Electron app entry');return;}
  requireModules([...appModules,...networkModules]);
  const {loadContent}=await import('../../src/content');
  const dir=await mkdtemp(join(tmpdir(),'prism-qa-'));
  const port=await freePort(),password=randomUUID();
  let app:Awaited<ReturnType<typeof electron.launch>>|undefined;
  let guest:Peer|undefined;
  try{
    app=await electron.launch({args:[resolve(entry),'--user-data-dir='+dir],executablePath:process.env.PB_E2E_ELECTRON_EXE,timeout:25000});
    const actual=await app.evaluate(({app})=>app.getPath('userData'));
    expect(resolve(actual).toLowerCase()).toBe(resolve(dir).toLowerCase());
    const page=await app.firstWindow();
    await expect(page.locator('#menus [data-focus=campaign]')).toBeVisible();
    expect(await page.evaluate(()=>typeof window.prismDesktop?.getVersion)).toBe('function');
    expect(await page.evaluate(()=>typeof window.prismDesktop?.startHost)).toBe('function');
    // Host through the normal desktop UI, not a test bridge.
    await page.locator('#menus [data-focus=coop]').click();
    await page.locator('#lobby input[name=name]').fill('Desktop QA');
    await page.locator('#lobby input[name=port]').fill(String(port));
    await page.locator('#lobby input[name=password]').fill(password);
    await page.locator('#lobby button[type=submit]').click();
    guest=new Peer('ws://127.0.0.1:'+port);
    await guest.open();
    guest.send({type:'join',protocolVersion:1,contentDigest:loadContent().contentDigest,name:'Remote QA',password});
    const welcome=await guest.wait('welcome');
    expect(welcome.room.players.length).toBe(2);
    const path=info.outputPath('windows-desktop-lobby.png');
    await page.screenshot({path});await info.attach('Windows lobby',{path,contentType:'image/png'});
    await page.locator('#lobby [data-focus=back]').click();
    await guest.waitClosed();
    await assertPortClosed(port);
  }finally{
    try{await guest?.close();}finally{
      try{if(app)await bounded(app.close(),10000,'Electron shutdown');}
      finally{await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
    }
  }
});
