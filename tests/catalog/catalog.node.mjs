import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generate, generateSource } from '../../scripts/generate-content.mjs';
// The override permits running against a standalone tsc build of the same sources.
const mod = await import(process.env.CATALOG_COMPILED ? pathToFileURL(join(process.env.CATALOG_COMPILED,'content/index.js')).href : '../../src/content/index.ts');
const manifest = await import(process.env.CATALOG_COMPILED ? pathToFileURL(join(process.env.CATALOG_COMPILED,'content/manifest.js')).href : '../../src/content/manifest.ts');
const {assembleContent, validateContent}=mod;
const {sha256,resourceKeys,contentDigest,createManifest,compatibilityError,reconcileCampaignRewards}=manifest;
const towerIDs='needle cannon rail scatter saw ember frost tesla venom prism mortar rocket drone mine resonator chrono gravity mirror portal storm beacon forge observatory mint bank orchard harbor tide coral bastion'.split(' ');
const mapIDs='lantern-garden copper-creek windmill-fields old-aqueduct orchard-wall freight-yard bell-foundry tidal-docks salt-marsh coral-gate clock-square fallen-observatory prism-quarry mirror-terrace glass-switchback fracture-bridge vault-district storm-coast black-lighthouse heart-of-storm'.split(' ');
const enemyIDs='scarlet amber lemon jade azure violet iron glass cloak regrow shield split ruby glacier copper obsidian dart swarm aegis royal hollow prismatic juggernaut herald'.split(' ');
const bossIDs='boss-carapace boss-brood boss-mirror boss-chrono boss-tempest boss-eclipse'.split(' ');
const modeIDs='standard half-cash no-leaks iron-oath short-supply blackout stormfront overdrive low-tech no-actives'.split(' ');
const difficultyIDs=['easy','normal','hard','extreme'];
const branches=['ballistics','elements','engineering','commerce','lighthouse'];
const art=(id,name)=>({asset:`/art/towers/${id}/${name}.svg`,accent:'#aabbcc',muzzle:'shot',projectile:'bolt',impact:'spark',scale:1,glow:0,motion:'none'});
const attack=()=>({mode:'shot',element:'kinetic',damage:2,interval:.5,range:100,pierce:1,count:1,splash:0,chains:0,chainRadius:0,detects:false,armorPierce:0,shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,statuses:[],projectileSpeed:100,projectileRadius:2,homing:false,windup:0,arc:0});
function tower(id){return {id,name:id,description:'Tower',category:'weapon',cost:100,footprint:12,placement:'land',attack:attack(),effects:[],abilities:[],visual:art(id,'base'),paths:['a','b','c'].map(p=>({id:p,name:p,description:'Path',upgrades:Array.from({length:5},(_,i)=>({id:p+(i+1),tier:i+1,name:p+(i+1),description:'Upgrade',cost:100*(i+1),delta:{damageMul:1.1},visual:art(id,p+(i+1))}))}))};}
function map(id,i){return {id,name:id,description:'Map',difficulty:Math.min(4,Math.floor(i/5)+1),campaignIndex:i+1,recommendedDifficulty:difficultyIDs[Math.min(3,Math.floor(i/5))],waveOverrides:{},lanes:[[{x:0,y:100},{x:1280,y:100}]],pathWidth:30,blocked:[],water:[],theme:'garden',background:`/art/maps/${id}/background.svg`};}
function enemy(id,boss=false){return {id,name:id,description:'Enemy',color:'#000000',shape:'orb',hp:10,speed:20,bounty:2,leak:1,radius:4,armor:0,shield:0,regen:0,cloaked:false,flying:false,resist:{},children:[],layers:[{hp:4,cash:1,color:'red'},{hp:6,cash:1,color:'blue'}],...(boss?{boss:{controlFactor:.5,phases:[]}}:{})};}
function fixture(extra=false){
  const towers=[...towerIDs,...(extra?['fixture31']:[])].map(tower);
  const maps=[...mapIDs,...(extra?['fixture21']:[])].map(map);
  const remaining=towers.filter(t=>!['needle','cannon','frost','beacon'].includes(t.id)).map(t=>t.id);
  const campaign=maps.map((m,i)=>({id:`node-${i+1}`,mapId:m.id,prerequisites:i?[`node-${i}`]:[],unlocks:i===0?remaining:[],title:m.id,briefing:'Brief',outro:'Outro'}));
  const knowledge=branches.flatMap(branch=>Array.from({length:30},(_,i)=>({id:`${branch}-${i+1}`,branch,index:i+1,name:`${branch} ${i+1}`,description:'Knowledge',requires:i?[`${branch}-${i}`]:[],minLevel:1+4*Math.floor(i/5),pointCost:1,sealCost:Math.ceil((20+5*(i+1)+(i+1)**2/3)/5)*5,effects:[{stat:'weaponDamage',value:.01}],icon:`/art/knowledge/${branch}-${i+1}.svg`})));
  const waves=Array.from({length:100},(_,i)=>{const n=i+1,boss=bossIDs[[10,20,40,60,80,100].indexOf(n)];return {number:n,groups:[{enemy:boss??'scarlet',count:1,at:0,every:1,lane:0}],reward:80+4*n,preview:'Wave',...(boss?{boss}:{})};});
  const config={version:1,towers,maps,knowledge,campaign,enemies:[...enemyIDs.map(id=>enemy(id)),...bossIDs.map(id=>enemy(id,true))],waves,modes:modeIDs.map(id=>({id,name:id,description:'Mode',modifiers:{},requiresClear:id!=='standard'})),economy:{xpCurve:[200,40,5],maxRewardLevel:51,pointsPerLevel:3,mapXP:[250,400,600,900],mapSeals:[80,120,180,260],modeReward:Object.fromEntries(modeIDs.map(id=>[id,1])),firstClearXP:1.5,repeatXP:.65,repeatSeals:.35,defeatXP:.35,respecCost:200},difficulties:difficultyIDs.map((id,i)=>({id,name:id,rounds:40+i*20,lives:100,startCredits:900,towerCostMul:1,enemyHpMul:1,roundRewardBase:80,roundRewardStep:4,popCashMul:1,rewardMul:1})),contentVersion:extra?'1.1.0':'1.0.0',contentDigest:'',knowledgeDiscount:0,startCredits:900,startLives:150,sellRatio:.7};
  const hashes=Object.fromEntries(resourceKeys(config).map(k=>[k,sha256(k)]));
  return {config,hashes};
}
function factories(c){return {towers:c.towers.map(v=>()=>v),maps:c.maps.map(v=>()=>v),knowledge:branches.map(b=>()=>c.knowledge.filter(k=>k.branch===b)),enemies:()=>c.enemies.filter(e=>!e.boss),bosses:()=>c.enemies.filter(e=>e.boss),waves:()=>c.waves,modes:()=>c.modes,campaign:()=>c.campaign,economy:()=>c.economy,difficulties:()=>c.difficulties,endless:(n)=>({...c.waves[0],number:n})};}
const temp=()=>mkdtempSync(join(tmpdir(),'catalog70-'));
function put(root,path,content){const file=join(root,path);mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,content);}

test('SHA-256 matches Node crypto, including UTF-8 and multi-block inputs',()=>{
  for(const text of ['', 'abc','Призма 🗼', 'x'.repeat(10000)]) assert.equal(sha256(text),createHash('sha256').update(text).digest('hex'));
});
test('full release fixture validates and constructs independent configurations',()=>{
  const {config,hashes}=fixture();assert.deepEqual(validateContent(config,hashes),[]);
  const a=assembleContent(factories(config),hashes),b=assembleContent(factories(config),hashes);
  assert.equal(a.contentDigest,b.contentDigest);assert.equal(a.endlessWave(123,8).number,123);
  a.towers[0].cost+=1;assert.notEqual(a.towers[0].cost,b.towers[0].cost);assert.equal(config.towers[0].cost,100);
});
test('registry enumeration and object key ordering do not alter digest',()=>{
  const {config,hashes}=fixture();const initial=contentDigest(config,hashes);
  for(const k of ['towers','maps','enemies','modes','campaign','knowledge','waves','difficulties'])config[k].reverse();
  const reordered=Object.fromEntries(Object.entries(config).reverse());
  assert.equal(contentDigest(reordered,Object.fromEntries(Object.entries(hashes).reverse())),initial);
});
test('price, geometry, semantic layer order, resource bytes and release version alter digest',()=>{
  const {config,hashes}=fixture(),original=contentDigest(config,hashes);
  for(const mutate of [c=>c.towers[0].cost++,c=>c.maps[0].lanes[0][1].y++,c=>c.enemies[0].layers.reverse(),c=>c.contentVersion='1.0.1']){
    const clone=structuredClone(config);mutate(clone);assert.notEqual(contentDigest(clone,hashes),original);
  }
  const key=resourceKeys(config)[0];assert.notEqual(contentDigest(config,{...hashes,[key]:sha256('changed')}),original);
});
test('unknown wave, child, knowledge scope and campaign reward IDs are rejected',()=>{
  const {config,hashes}=fixture();config.waves[0].groups[0].enemy='missing-enemy';config.enemies[0].children.push({id:'missing-child',count:1});config.knowledge[0].effects[0].towers=['missing-tower'];config.campaign[0].unlocks.push('missing-reward');
  const errors=validateContent(config,hashes).join('\n');for(const id of ['missing-enemy','missing-child','missing-tower','missing-reward'])assert.match(errors,new RegExp(id));
});
test('missing SVG, duplicate ID, invalid upgrades/layers, campaign cycle and group errors are rejected',()=>{
  const {config,hashes}=fixture();delete hashes['art/towers/needle/a1-overlay.svg'];config.towers[1].id=config.towers[0].id;config.towers[0].paths[0].upgrades.pop();config.enemies[0].layers[0].cash++;config.campaign[0].prerequisites=['node-2'];config.maps[0].difficulty=2;
  const errors=validateContent(config,hashes).join('\n');for(const match of [/duplicate ID/,/5 upgrades/,/layer cash sum/,/cycle/,/wrong base index\/group/,/a1-overlay.svg/])assert.match(errors,match);
});
test('expanded release accepts 31 towers and 21 maps; manifest preserves independent versions',()=>{
  const {config,hashes}=fixture(true);const c=assembleContent(factories(config),hashes,config.contentVersion);const m=createManifest(c);assert.equal(m.towers.length,31);assert.equal(m.maps.length,21);assert.equal(m.schema,1);assert.equal(m.protocol,1);assert.equal(m.contentVersion,'1.1.0');assert.ok(m.towers.includes('fixture31'));assert.ok(m.maps.includes('fixture21'));
});
test('generator discovers extension modules automatically, deterministic output and stale check',()=>{
  const root=temp();try{
    for(const [folder,method,id] of [['towers','getTower','needle'],['maps','getMap','lantern-garden'],['knowledge','getKnowledge','ballistics']])put(root,`src/content/${folder}/${id}.ts`,`export const ${method}=()=>({});`);
    put(root,'public/art/towers/needle/base.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');
    generate(root);assert.equal(generate(root,true),false);const before=readFileSync(join(root,'src/content/generated.ts'),'utf8');
    put(root,'src/content/maps/fixture21.ts','export const getMap=()=>({});');put(root,'src/content/towers/fixture31.ts','export const getTower=()=>({});');
    assert.throws(()=>generate(root,true),/Stale/);generate(root);const after=generateSource(root);assert.notEqual(after,before);assert.match(after,/from '\.\/towers\/fixture31'/);assert.match(after,/from '\.\/maps\/fixture21'/);assert.equal(generate(root,true),false);
    put(root,'public/art/towers/needle/base.svg','<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>');assert.throws(()=>generate(root,true),/Stale/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('generator refuses symlinks rather than inspecting external files',()=>{
  const root=temp(),outside=temp();try{mkdirSync(join(root,'src/content/towers'),{recursive:true});symlinkSync(outside,join(root,'src/content/towers/external'),'junction');assert.throws(()=>generateSource(root),/Symlink/);}finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
test('compatibility guard rejects changed content or protocol before accepting a join',()=>{
  const {config,hashes}=fixture();const current=assembleContent(factories(config),hashes);const hello={protocolVersion:1,contentDigest:current.contentDigest};assert.equal(compatibilityError(current,hello),null);
  config.towers[0].cost++;const updated=assembleContent(factories(config),hashes);assert.equal(compatibilityError(updated,hello),'content-mismatch');assert.equal(compatibilityError(current,{...hello,protocolVersion:2}),'protocol-mismatch');
});
test('additive campaign migration preserves progress, currencies, unknown IDs and is idempotent',()=>{
  const profile={version:1,settings:{language:'ru'},medals:{'old-map':3},unlockedCosmetics:['retired'],bestWave:{'old-map':50},completedRuns:2,tutorialSeen:true,completedNodes:['node-1','retired-node'],unlockedTowers:['needle','retired-tower'],xp:700,level:3,seals:80,knowledgePoints:4,knowledgeUnlocked:['old-knowledge'],knowledgePaid:['old-knowledge'],claimedRuns:['run-1'],respecCount:0};
  const nodes=[{id:'node-1',unlocks:['needle','fixture31']},{id:'node-2',unlocks:['not-yet']}];
  const before=structuredClone(profile),after=reconcileCampaignRewards(profile,nodes);assert.deepEqual(profile,before);assert.deepEqual(after,{...before,unlockedTowers:['needle','retired-tower','fixture31']});assert.deepEqual(reconcileCampaignRewards(after,nodes),after);
  assert.deepEqual(JSON.parse(JSON.stringify(after)),after);
});
