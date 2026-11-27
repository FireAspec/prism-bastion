import type { RenderPreferences, StatusKind, Vec } from '../../contracts';
import type { EnemyAppearance, EnemyEffect } from './index';

const glyphs: Record<StatusKind, string> = { burn: '▲', poison: '×', slow: '≋', freeze: '❄', stun: '!', mark: '⊕', shred: '▱', wet: '◇', reveal: '◎' };
const colors: Record<StatusKind, string> = { burn: '#ff9d58', poison: '#a5e38b', slow: '#98beff', freeze: '#c8f6ff', stun: '#ffe68a', mark: '#f8b0c2', shred: '#ddd4c5', wet: '#83d6ff', reveal: '#f9e8aa' };
/** All coordinates are world pixels. The caller owns DPR and the canvas transform. */
export function paintEnemyAppearance(ctx: CanvasRenderingContext2D, pos: Vec, radius: number, a: EnemyAppearance, prefs: RenderPreferences): void {
  ctx.save(); ctx.translate(pos.x, pos.y); ctx.lineWidth = 1.7;
  if (a.shield) {
    ctx.strokeStyle = '#a6e9ff'; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.arc(0, 0, radius + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (a.phase > 0) {
    ctx.strokeStyle = '#ffda85'; ctx.beginPath(); ctx.arc(0, 0, radius + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffda85'; for (let i = 0; i < Math.min(6, a.phase); i++) { const x = (i - (Math.min(6, a.phase) - 1) / 2) * 6; ctx.fillRect(x - 2, radius + 9, 4, 4); }
  }
  if (prefs.colorblind || a.layer > 0) {
    ctx.strokeStyle = '#f6f0db'; ctx.lineWidth = 2; const n = Math.min(6, a.layer + 1);
    for (let i = 0; i < n; i++) { const angle = i * Math.PI * 2 / n - Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .68, Math.sin(angle) * radius * .68); ctx.lineTo(Math.cos(angle) * radius * .9, Math.sin(angle) * radius * .9); ctx.stroke(); }
  }
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < a.statuses.length; i++) {
    const k = a.statuses[i], x = (i % 5 - (Math.min(5, a.statuses.length) - 1) / 2) * 13, y = -radius - 12 - Math.floor(i / 5) * 14;
    ctx.fillStyle = '#152837'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = colors[k]; ctx.fillText(glyphs[k], x, y);
  }
  ctx.restore();
}
export function paintEnemyEffects(ctx: CanvasRenderingContext2D, effects: readonly EnemyEffect[], prefs: RenderPreferences): void {
  for (const e of effects) {
    const t = Math.max(0, Math.min(1, e.age / e.duration)); if (t >= 1) continue;
    ctx.save(); ctx.translate(e.pos.x, e.pos.y); ctx.globalAlpha *= (1 - t) * .85; ctx.lineWidth = 2;
    const color = e.kind === 'shieldBreak' ? '#a6e9ff' : e.kind === 'bossPhase' ? '#ffda85' : e.kind === 'leak' ? '#f5c985' : e.color;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    if (prefs.reducedMotion || e.kind === 'hit' || e.kind === 'bossPhase' || e.kind === 'leak' || e.kind === 'split') {
      const radius = (e.kind === 'bossPhase' ? 24 : e.kind === 'split' ? 14 : 8) + (prefs.reducedMotion ? 0 : t * 12);
      if (e.kind === 'leak') ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
      if (e.kind === 'bossPhase' || e.kind === 'split') { ctx.beginPath(); ctx.arc(0, 0, radius * .66, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      const n = prefs.quality === 'low' ? 3 : e.kind === 'kill' ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = e.angle + (i - (n - 1) / 2) * .48, d = 3 + t * (e.kind === 'kill' ? 28 : 19);
        ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(a + t * .9);
        ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(5, 0); ctx.lineTo(-1, 3); ctx.closePath();
        if (e.kind === 'shieldBreak') ctx.stroke(); else ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();
  }
}
