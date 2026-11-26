import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

async function main(){
 const server=await createServer({server:{host:'127.0.0.1',port:0},configFile:false});
 await server.listen();
 const address=server.httpServer!.address();
 assert(address&&typeof address!=='string');
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try {
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+address.port+'/tests/ui/hud/browser.html');
  const control=(key:string)=>page.locator('[data-action="'+key+'"]');
  await control('buy-needle').waitFor();
  assert.equal(await page.locator('.pb-hud-card').count(),30);
  assert.match(await control('buy-rail').innerText(),/Поля ветряков/);
  const field=await page.locator('#field').boundingBox(),rail=await page.locator('.pb-hud-side').boundingBox(),top=await page.locator('.pb-hud-top').boundingBox();
  assert(field&&rail&&top);assert(field.x+field.width<=rail.x+1);assert(top.y+top.height<=field.y+1);
  const search=page.locator('input[type=search]');await search.fill('needle');
  await page.evaluate(()=>{(window as any).hudFixture.patch({credits:800});});
  assert.equal(await search.evaluate(n=>document.activeElement===n),true);
  assert.equal(await search.inputValue(),'needle');assert.equal(await page.locator('.pb-hud-card').count(),1);
  await search.fill('');await control('buy-needle').click();
  assert.equal(await page.evaluate(()=>(window as any).hudFixture.placing),'needle');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>(window as any).hudFixture.placing),null);
  await page.evaluate(()=>{(window as any).hudFixture.select('t1');});
  assert.equal(await page.locator('.pb-hud-tile').count(),15);
  const permutations=[[5,2,0],[5,0,2],[2,5,0],[0,5,2],[2,0,5],[0,2,5]];
  for(const tiers of permutations){
   await page.evaluate(t=>(window as any).hudFixture.tiers(t),tiers);
   const primary=tiers.indexOf(5),secondary=tiers.indexOf(2);
   assert.match((await page.locator('.pb-hud-tower-head img').first().getAttribute('src'))??'',new RegExp('abc'[primary]+'5.svg$'));
   assert.match((await page.locator('.pb-hud-tower-head img.pb-hud-overlay').getAttribute('src'))??'',new RegExp('abc'[secondary]+'2-overlay.svg$'));
  }
  await page.evaluate(()=>{(window as any).hudFixture.tiers([1,1,0]);});
  assert.equal(await control('upgrade-t1-2-1').getAttribute('aria-disabled'),'true');
  await page.evaluate(()=>{(window as any).hudFixture.tiers([3,2,0]);});
  assert.equal(await control('upgrade-t1-1-3').getAttribute('aria-disabled'),'true');
  await page.evaluate(()=>{(window as any).hudFixture.tiers([0,0,0]);});
  const next=control('upgrade-t1-0-1');await next.focus();
  await page.evaluate(()=>{(window as any).hudFixture.patch({credits:1});});
  assert.equal(await next.evaluate(n=>document.activeElement===n),true);
  assert.equal(await next.getAttribute('aria-disabled'),'true');
  await page.evaluate(()=>{(window as any).hudFixture.patch({credits:900});});
  await next.click();await next.dispatchEvent('click');
  assert.equal(await page.evaluate(()=>(window as any).hudFixture.commands.length),1);
  await page.evaluate(()=>{(window as any).hudFixture.settle('1');});
  assert.equal(await next.getAttribute('aria-disabled'),'false');
  await next.click();assert.equal(await page.evaluate(()=>(window as any).hudFixture.commands.length),2);
  await page.evaluate(()=>{(window as any).hudFixture.tiers([1,0,0]);});
  assert.equal(await control('upgrade-t1-0-2').getAttribute('aria-disabled'),'false');
  await page.evaluate(()=>{(window as any).hudFixture.refundMode();});
  assert.equal(await control('sell-t1').getAttribute('aria-disabled'),'true');
  await page.evaluate(()=>{(window as any).hudFixture.foreign();});
  assert.match(await page.locator('.pb-hud-owner').innerText(),/Гость/);
  assert.equal(await control('upgrade-t1-0-2').getAttribute('aria-disabled'),'true');
  await mkdir('test-results/hud',{recursive:true});
  await page.screenshot({path:'test-results/hud/selected-1366.png'});
  await control('shopTab').click();await page.screenshot({path:'test-results/hud/shop-1366.png'});
  await page.evaluate(()=>{(window as any).hudFixture.dispose();});
  assert.equal(await page.locator('.pb-hud').count(),0);
  assert.deepEqual(errors,[]);
  console.log('HUD browser acceptance passed');
 } finally {await browser?.close();await server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
