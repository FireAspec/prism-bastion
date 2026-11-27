import {test,expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {requireModules,unavailable} from './preflight';

test('all 450 catalog upgrade images decode, T5 variants are distinct',async({page})=>{
  requireModules(['src/content/index.ts']);
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tests/e2e/gallery.html');
  await expect(page.locator('#status')).toHaveText('450');
  const imgs=page.locator('figure img');
  await expect(imgs).toHaveCount(450);
  const results=await imgs.evaluateAll(async nodes=>Promise.all(nodes.map(async node=>{
    const img=node as HTMLImageElement;
    try{await img.decode();return {key:img.parentElement?.dataset.upgrade,url:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight,ok:true};}
    catch{return {key:img.parentElement?.dataset.upgrade,url:img.src,width:0,height:0,ok:false};}
  })));
  expect(results.filter(r=>!r.ok||r.width===0||r.height===0)).toEqual([]);
  expect(new Set(results.map(r=>r.key)).size).toBe(450);
  expect(new Set(results.map(r=>r.url)).size).toBe(450);
  const t5=results.filter(r=>r.key?.endsWith('-5'));
  expect(t5).toHaveLength(90);
  const payloads=await page.evaluate(async urls=>Promise.all(urls.map(async url=>{
    const response=await fetch(url);if(!response.ok)throw new Error('Asset unavailable: '+url);
    const bytes=await response.arrayBuffer();
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  })),t5.map(r=>r.url));
  expect(new Set(payloads).size).toBe(90);
  expect(errors).toEqual([]);
  await test.info().attach('upgrade-inventory',{body:JSON.stringify(results,null,2),contentType:'application/json'});
});

test('T5 gallery visual capture at native test viewport',async({page},info)=>{
  requireModules(['src/content/index.ts']);
  await page.goto('/tests/e2e/gallery.html?tier=5');
  await expect(page.locator('#status')).toHaveText('90');
  const images=page.locator('figure img');
  await expect(images).toHaveCount(90);
  await images.evaluateAll(nodes=>Promise.all(nodes.map(n=>(n as HTMLImageElement).decode())));
  const path=info.outputPath('t5-gallery.png');
  await page.screenshot({path,fullPage:true,animations:'disabled'});
  await info.attach('T5 gallery',{path,contentType:'image/png'});
});

test('T5 visual regression against reviewed baseline',async({page},info)=>{
  requireModules(['src/content/index.ts']);
  if(!existsSync(info.snapshotPath('t5-gallery.png'))&&process.env.PB_E2E_CREATE_BASELINES!=='1'){
    unavailable('No reviewed T5 baseline for '+info.project.name);return;
  }
  await page.goto('/tests/e2e/gallery.html?tier=5');
  await expect(page.locator('#status')).toHaveText('90');
  await page.locator('figure img').evaluateAll(nodes=>Promise.all(nodes.map(n=>(n as HTMLImageElement).decode())));
  await expect(page).toHaveScreenshot('t5-gallery.png',{fullPage:true,animations:'disabled',maxDiffPixelRatio:0.001});
});
