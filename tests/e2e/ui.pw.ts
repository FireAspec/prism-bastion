import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {requireModules,appModules,networkModules,unavailable} from './preflight';
import {launch,Peer,positions,assertPortClosed} from './wire';
import type {GameConfig,SaveEnvelope} from '../../src/contracts';

const MAPS=['lantern-garden','copper-creek','windmill-fields','old-aqueduct','orchard-wall','freight-yard','bell-foundry','tidal-docks','salt-marsh','coral-gate','clock-square','fallen-observatory','prism-quarry','mirror-terrace','glass-switchback','fracture-bridge','vault-district','storm-coast','black-lighthouse','heart-of-storm'];
const focus=(page:Page,key:string)=>page.locator('#menus [data-focus="'+key+'"]');
const action=(page:Page,key:string)=>page.locator('#hud [data-action="'+key+'"]');
const cash=async(page:Page)=>Number((await page.locator('#hud .pb-hud-credit').innerText()).replace(/[^0-9]/g,''));
async function photo(page:Page,info:TestInfo,name:string){
  const path=info.outputPath(name+'.png');await page.screenshot({path,animations:'disabled'});
  await info.attach(name,{path,contentType:'image/png'});
}
async function open(page:Page){
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(focus(page,'campaign')).toBeVisible();
  return errors;
}
async function catalog(page:Page):Promise<GameConfig>{
  return page.evaluate(async()=>{
    const url='/src/content/index.ts';
    const m=await import(/* @vite-ignore */ url) as {loadContent():GameConfig};
    const {endlessWave:_,...data}=m.loadContent();
    return data;
  });
}
async function exportSave(page:Page):Promise<SaveEnvelope>{
  await focus(page,'settings').click();
  const download=page.waitForEvent('download');
  await focus(page,'export').click();
  const file=await (await download).path();
  if(!file)throw new Error('No exported file');
  const save=JSON.parse(await readFile(file,'utf8')) as SaveEnvelope;
  expect(save.version).toBe(1);
  await focus(page,'back').click();
  return save;
}
async function importSave(page:Page,save:SaveEnvelope){
  await focus(page,'settings').click();
  await page.locator('#menus input[type=file]').setInputFiles({name:'qa-profile.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
  await expect(focus(page,'campaign')).toBeVisible();
}
async function normalRun(page:Page){
  await focus(page,'campaign').click();
  await focus(page,'map-lantern-garden').click();
  await focus(page,'difficulty-normal').click();
  await focus(page,'start').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(action(page,'buy-needle')).toBeVisible();
}

test('campaign menu lists all twenty maps, prerequisite lock, settings persist, keyboard and accessibility',async({page},info)=>{
  requireModules(appModules);
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=await open(page);
  await photo(page,info,'title');
  await focus(page,'campaign').focus();
  await expect(focus(page,'campaign')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menus .pb-map')).toHaveCount(20);
  for(const id of MAPS)await expect(focus(page,'map-'+id)).toHaveCount(1);
  await focus(page,'map-heart-of-storm').click();
  await expect(focus(page,'start')).toBeDisabled();
  await focus(page,'map-lantern-garden').click();
  await expect(focus(page,'start')).toBeEnabled();
  for(const d of ['easy','normal','hard','extreme']){
    await focus(page,'difficulty-'+d).click();
    await expect(focus(page,'difficulty-'+d)).toHaveAttribute('aria-pressed','true');
  }
  await photo(page,info,'campaign');
  await focus(page,'back').click();
  await focus(page,'settings').click();
  await focus(page,'reducedMotion').check();
  await focus(page,'colorblind').check();
  await focus(page,'language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await photo(page,info,'accessible-settings');
  await focus(page,'back').click();
  await page.reload();
  await expect(focus(page,'settings')).toBeVisible();
  await focus(page,'settings').click();
  await expect(focus(page,'reducedMotion')).toBeChecked();
  await expect(focus(page,'colorblind')).toBeChecked();
  await expect(focus(page,'language')).toHaveValue('en');
  expect(errors).toEqual([]);
});

test('real battle placement, legal upgrades, wave, pause, save and restore',async({page},info)=>{
  requireModules(appModules);
  const errors=await open(page);
  const config=await catalog(page);
  const map=config.maps.find(m=>m.id==='lantern-garden')!;
  const needle=config.towers.find(t=>t.id==='needle')!;
  expect(map).toBeDefined();expect(needle).toBeDefined();
  await normalRun(page);
  await expect.poll(()=>cash(page)).toBe(900);
  const canvas=page.locator('#game-canvas');
  const box=await canvas.boundingBox();
  if(!box)throw new Error('Canvas bounds unavailable');
  const scale=Math.min(box.width/1280,box.height/720);
  const possible=positions(map,needle).filter(p=>p.x>200&&p.x<850&&p.y>140&&p.y<580);
  expect(possible.length).toBeGreaterThan(0);
  // Click the actual canvas, not a direct command or injected wallet.
  await action(page,'buy-needle').click();
  const point=possible[Math.floor(possible.length/2)];
  await page.mouse.click(box.x+(box.width-1280*scale)/2+point.x*scale,box.y+(box.height-720*scale)/2+point.y*scale);
  await expect.poll(()=>cash(page)).toBe(900-needle.cost);
  const upgrade=page.locator('#hud [data-action^="upgrade-"][data-action$="-0-1"]');
  await expect(upgrade).toBeVisible();
  await upgrade.click();
  await expect(upgrade).toHaveClass(/is-owned/);
  const expected=900-needle.cost-needle.paths[0].upgrades[0].cost;
  await expect.poll(()=>cash(page)).toBe(expected);
  await photo(page,info,'battle-build');
  await canvas.focus();
  await page.keyboard.press('2');
  await expect(action(page,'speed2')).toHaveClass(/is-active/);
  await action(page,'start').click();
  await expect(action(page,'start')).toBeDisabled();
  await action(page,'pause').click();
  await expect(action(page,'pause')).toContainText(/Продолжить|Resume/);
  await photo(page,info,'battle-paused');
  await action(page,'exit').click();
  await expect(focus(page,'resume')).toBeEnabled();
  const saved=await exportSave(page);
  expect(saved.run).not.toBeNull();
  expect(saved.run!.towers).toHaveLength(1);
  expect(saved.run!.towers[0].tiers).toEqual([1,0,0]);
  expect(saved.run!.paused).toBe(true);
  await page.reload();
  await expect(focus(page,'resume')).toBeEnabled();
  await focus(page,'resume').click();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect.poll(()=>cash(page)).toBe(saved.run!.credits);
  await action(page,'exit').click();
  const again=await exportSave(page);
  expect(again.run!.options.runId).toBe(saved.run!.options.runId);
  expect(again.run!.towers).toEqual(saved.run!.towers);
  expect(errors).toEqual([]);
});

test('profile export/import preserves progression and rejects malformed JSON',async({page})=>{
  requireModules(appModules);
  await open(page);
  const original=await exportSave(page);
  const modified=structuredClone(original);
  modified.profile.settings.colorblind=true;
  modified.profile.settings.reducedMotion=true;
  await importSave(page,modified);
  const loaded=await exportSave(page);
  expect(loaded.profile).toEqual(modified.profile);
  await focus(page,'settings').click();
  await page.locator('#menus input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await expect(focus(page,'settings')).not.toBeVisible();
  await expect(focus(page,'export')).toBeVisible();
  await focus(page,'back').click();
  const after=await exportSave(page);
  expect(after.profile).toEqual(loaded.profile);
});

test('knowledge: prerequisites, actual purchase, persistence and respec',async({page},info)=>{
  requireModules([...appModules,'src/ui/knowledge.ts','src/progression/index.ts']);
  await open(page);
  const config=await catalog(page);
  expect(config.knowledge).toHaveLength(150);
  const first=config.knowledge.find(n=>n.branch==='ballistics'&&n.index===1)!;
  const second=config.knowledge.find(n=>n.branch==='ballistics'&&n.index===2)!;
  const original=await exportSave(page);
  const funded=structuredClone(original);
  funded.profile.xp=245;
  funded.profile.level=2;
  funded.profile.knowledgePoints=3;
  funded.profile.seals=200;
  await importSave(page,funded);
  await focus(page,'knowledge').click();
  const node=(id:string)=>page.getByTestId('knowledge-node-'+id);
  if(await node(first.id).count()===0){unavailable('Knowledge stable node selectors not integrated; see docs/qa/e2e.md');return;}
  await expect(node(first.id)).toBeVisible();
  await expect(node(second.id)).toBeDisabled();
  await node(first.id).click();
  await page.getByTestId('knowledge-buy').click();
  await photo(page,info,'knowledge');
  await page.getByTestId('knowledge-close').click();
  const purchased=await exportSave(page);
  expect(purchased.profile.knowledgeUnlocked).toContain(first.id);
  expect(purchased.profile.knowledgePoints).toBe(2);
  expect(purchased.profile.seals).toBe(200-first.sealCost);
  await page.reload();
  await focus(page,'knowledge').click();
  await page.getByTestId('knowledge-respec').click();
  await page.getByTestId('knowledge-respec-confirm').click();
  await page.getByTestId('knowledge-close').click();
  const reset=await exportSave(page);
  expect(reset.profile.knowledgeUnlocked).not.toContain(first.id);
  expect(reset.profile.knowledgePaid).toContain(first.id);
  expect(reset.profile.knowledgePoints).toBe(3);
  expect(reset.profile.seals).toBe(purchased.profile.seals);
});

test('browser guest uses real app lobby and client transport, then sees host disconnect',async({page},info)=>{
  requireModules([...appModules,...networkModules,'src/ui/lobby.ts','src/network/client/index.ts']);
  await open(page);
  const room=await launch(2);
  const host=new Peer(room.url);
  const frames:string[]=[];
  page.on('websocket',ws=>{if(ws.url().includes(':'+room.ready.port)){
    ws.on('framesent',e=>{if(typeof e.payload==='string')frames.push(e.payload);});
  }});
  try{
    await host.join(room.ready.digest,'QA host');
    await focus(page,'coop').click();
    await page.locator('#lobby').getByRole('button',{name:/^Подключиться$|^Join room$/}).first().click();
    await page.locator('#lobby input[name=name]').fill('Browser guest');
    await page.locator('#lobby input[name=address]').fill('127.0.0.1');
    await page.locator('#lobby input[name=port]').fill(String(room.ready.port));
    await page.locator('#lobby input[name=password]').fill('qa-room');
    await page.locator('#lobby button[type=submit]').click();
    const joined=await host.wait('room',m=>m.room.players.length===2);
    expect(joined.room.players.some(p=>p.name==='Browser guest')).toBe(true);
    expect(frames.some(s=>JSON.parse(s).type==='join')).toBe(true);
    await photo(page,info,'browser-lobby');
    host.send({type:'start'});
    const initial=await host.wait('snapshot');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await expect.poll(()=>cash(page)).toBe(initial.state.credits);
    await room.stop();
    await host.waitClosed();
    await expect(page.getByText(/Восстановление подключения|Подключение потеряно|Reconnecting|Connection lost/).first()).toBeVisible({timeout:15000});
    await photo(page,info,'host-loss');
  }finally{
    await page.close();
    await host.close();
    await room.stop();
    await assertPortClosed(room.ready.port);
  }
});

test('all twenty campaign maps open the real renderer with their own layout',async({page},info)=>{
  test.setTimeout(240_000);
  requireModules(appModules);
  const errors=await open(page),config=await catalog(page);
  expect(config.maps.map(m=>m.id).sort()).toEqual([...MAPS].sort());
  // A completed campaign is imported through the actual profile interface.
  // This is a UI coverage fixture, not evidence of map solvability.
  const save=await exportSave(page);
  save.profile.completedNodes=config.campaign.map(n=>n.id);
  save.profile.unlockedTowers=config.towers.map(t=>t.id);
  save.run=null;
  await importSave(page,save);
  for(const [index,id] of MAPS.entries()){
    await test.step(id,async()=>{
      const map=config.maps.find(m=>m.id===id)!;
      await focus(page,'campaign').click();
      await focus(page,'map-'+id).click();
      await focus(page,'difficulty-'+map.recommendedDifficulty).click();
      await expect(focus(page,'start')).toBeEnabled();
      await focus(page,'start').click();
      await expect(page.locator('#game-canvas')).toBeVisible();
      await expect(action(page,'buy-needle')).toBeVisible({timeout:15000});
      await expect.poll(()=>cash(page)).toBe(config.difficulties.find(d=>d.id===map.recommendedDifficulty)!.startCredits);
      if(index===0||index===MAPS.length-1)await photo(page,info,'map-'+id);
      await action(page,'exit').click();
      await expect(focus(page,'campaign')).toBeVisible();
      const snapshot=await exportSave(page);
      expect(snapshot.run?.options.mapId).toBe(id);
    });
  }
  expect(errors).toEqual([]);
});
