import { createEnemyMotion, ENEMY_MOTION_IDS } from '../../../src/render-animations/enemies';
import { paintEnemyAppearance, paintEnemyEffects } from '../../../src/render-animations/enemies/paint';
import type { GameEvent, RenderPreferences } from '../../../src/contracts';
import { advance, enemy, event, state, fixtureConfig } from './fixture';
const canvas = document.querySelector<HTMLCanvasElement>('#field')!;
const ctx = canvas.getContext('2d')!;
const input = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!;
const motion = createEnemyMotion(fixtureConfig(ENEMY_MOTION_IDS));
const prefs = (): RenderPreferences => ({ reducedMotion: input('reduced').checked, colorblind: input('colorblind').checked, quality: input('low').checked ? 'low' : 'high' });
const s = state();
let cycle = -1, last = performance.now(), paused = false;
const cell = (i: number) => ({ x: (i % 6) * 210 + 10, y: Math.floor(i / 6) * 142 + 5 });
function initialize() { s.enemies = []; s.time = 0; s.tick = 0; s.nextEvent = 1; cycle = -1; motion.reset(s); }
function step(dt: number) {
  s.speed = Number(input('speed').value) === 3 ? 3 : 1; s.paused = paused;
  const previous = s.time;
  if (!paused) advance(s, dt);
  const loop = Math.floor(s.time / 8), t = s.time % 8, prev = loop !== cycle ? -1 : previous % 8;
  const events: GameEvent[] = [];
  if (loop !== cycle) {
    cycle = loop;
    s.enemies = ENEMY_MOTION_IDS.map((id, i) => { const e = enemy(`e${loop}-${i}`, id), p = cell(i); e.pos = { x: p.x + 34, y: p.y + 66 }; e.shield = i % 4 === 1 || i >= 24 ? 20 : 0; events.push(event(s, 'spawn', e.id, e.pos)); return e; });
  }
  const crossed = (n: number) => prev < n && t >= n;
  for (let i = 0; i < s.enemies.length; i++) {
    const e = s.enemies[i], p = cell(i), d = Math.min(1, t / 6); e.progress = d * 135;
    e.pos = { x: p.x + 34 + d * 130, y: p.y + 66 + Math.sin(d * Math.PI * 2) * 18 };
    const contact = { x: e.pos.x + 12, y: e.pos.y - 6 };
    if (crossed(1.5)) { events.push(event(s, 'hit', e.id, contact)); if (e.shield > 0) { e.shield = 0; events.push(event(s, 'shieldBreak', e.id, contact)); } }
    if (crossed(2.5)) { e.paidLayers = [0,1]; events.push(event(s, 'layerBreak', e.id, contact, {layer:0}), event(s, 'layerBreak', e.id, contact, {layer:1})); }
    if (crossed(3.5)) e.statuses = [{kind: i % 2 ? 'freeze' : 'burn', remaining: 1, duration: 1, power:1, source:'fixture',stacks:1}];
    if (crossed(4.5)) { e.statuses = []; if (i >= 24) events.push(event(s, 'bossPhase', e.id, contact)); }
    if (crossed(6)) events.push(event(s, i % 7 === 0 ? 'leak' : 'kill', e.id, contact));
  }
  if (crossed(6)) s.enemies = [];
  motion.setPreferences(prefs()); motion.consume(events,s); motion.update(dt,s);
}
function body(id: string, defId: string, x: number, y: number, ghost = false) {
  const m = motion.sample(id), a = motion.appearance(id), boss = defId.startsWith('boss-'); if (!a) return;
  const n = ENEMY_MOTION_IDS.indexOf(defId), r = boss ? 20 : 14;
  ctx.save(); ctx.translate(x + m.offset.x, y + m.offset.y); ctx.rotate(m.rotation); ctx.scale(m.scale,m.scale); ctx.globalAlpha *= m.opacity;
  ctx.fillStyle = a.color; ctx.strokeStyle = '#f2e5ca'; ctx.lineWidth = 1.6;
  ctx.beginPath(); const sides = boss ? 7 : 3 + n % 5;
  for(let j=0;j<sides;j++){const angle=j*Math.PI*2/sides;const rr=j%2 && boss?r*.72:r;const xx=Math.cos(angle)*rr,yy=Math.sin(angle)*rr;if(j===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);} ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle = '#17313c';ctx.beginPath();ctx.moveTo(r*.67,0);ctx.lineTo(-r*.12,-r*.38);ctx.lineTo(-r*.12,r*.38);ctx.closePath();ctx.fill();
  if(m.glow>0){ctx.globalAlpha*=m.glow;ctx.fillStyle='#fff4d8';ctx.beginPath();ctx.arc(0,0,r*.5,0,Math.PI*2);ctx.fill();}ctx.restore();
  if(!ghost)paintEnemyAppearance(ctx,{x:x+m.offset.x,y:y+m.offset.y},r,a,prefs());
}
function draw() {
  const width = canvas.clientWidth || 1280, dpr = window.devicePixelRatio || 1, scale = width * dpr / 1280;
  const w = Math.round(1280 * scale), h = Math.round(720 * scale); if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle='#0b2028';ctx.fillRect(0,0,1280,720);
  for(let i=0;i<30;i++){const p=cell(i);ctx.fillStyle=i>=24?'#29343d':'#142e37';ctx.fillRect(p.x,p.y,200,134);ctx.strokeStyle='#3e555a';ctx.strokeRect(p.x+.5,p.y+.5,199,133);ctx.font='bold 13px system-ui';ctx.fillStyle='#e5dcc7';ctx.fillText(ENEMY_MOTION_IDS[i],p.x+11,p.y+20);ctx.strokeStyle='#537079';ctx.setLineDash([4,5]);ctx.beginPath();for(let j=0;j<=40;j++){const x=p.x+34+j/40*130,y=p.y+66+Math.sin(j/40*Math.PI*2)*18;if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.setLineDash([]);}
  for(const e of s.enemies)body(e.id,e.defId,e.pos.x,e.pos.y);
  for(const t of motion.tails())body(t.id,t.defId,t.pos.x,t.pos.y,true);
  paintEnemyEffects(ctx,motion.effects(),prefs());
  document.querySelector('#status')!.textContent=`${(s.time%8).toFixed(2)} s · ${motion.effects().length} FX · DPR ${dpr}`;
}
function frame(now: number){const dt=Math.min(.1,(now-last)/1000);last=now;step(dt);draw();requestAnimationFrame(frame);}
input('restart').onclick=()=>initialize();input('pause').onclick=()=>{paused=!paused;input('pause').textContent=paused?'Продолжить':'Пауза';};
initialize();requestAnimationFrame(frame);
