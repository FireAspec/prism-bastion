import type { LocaleCatalog, CommandResult } from '../contracts';
import { messages } from './catalog';
export { messages, type MessageKey } from './catalog';
export type Language = 'ru' | 'en';
export type Unit = 'credits' | 'waves' | 'lives' | 'points' | 'seals';
export interface GameLocale extends LocaleCatalog {
 readonly language: Language;
 number(value: number): string;
 count(unit: Unit, value: number): string;
 wave(wave: number, total: number, endless?: boolean): string;
 reason(reason?: string): string;
 result(result: CommandResult): string;
}
const aliases: Readonly<Record<string,string>> = Object.freeze({
 'locked-tower':'tower-locked','team-tier-five-limit':'tier5-limit','selling-disabled':'sell-disabled','abilities-disabled':'ability-disabled','unknown-ability':'not-found','not-building':'wave-active','run-complete':'run-ended','run-finished':'run-ended','server-only':'not-host','host-only':'not-host','unknown-tower':'not-found','unknown-node':'not-found','prerequisites':'prerequisite','level':'level-too-low','points':'insufficient-points','seals':'insufficient-seals','incompatible':'version-mismatch','wrong-password':'bad-password','invalid-resume':'resume-expired','invalid-message':'invalid-command','invalid-pause':'invalid-command','invalid-speed':'invalid-command','invalid-autostart':'invalid-command','invalid-actor':'invalid-command','invalid-targeting':'invalid-command','unknown-command':'invalid-command','invalid-owner':'invalid-command','invalid-claim':'invalid-command',
 'not-enough-money':'insufficient-credits', 'not-enough-credits':'insufficient-credits', 'insufficient-funds':'insufficient-credits', 'not-enough-cash':'insufficient-credits', 'invalid-position':'invalid-placement', 'invalid-crosspath':'cross-path', 'crosspath':'cross-path', 't5-limit':'tier5-limit', 'wrong-owner':'not-owner', 'forbidden':'unknown', 'insufficient-xp':'level-too-low', 'invalid-password':'bad-password', 'protocol-mismatch':'version-mismatch', 'content-mismatch':'version-mismatch', 'already-unlocked':'already-owned', 'missing-prerequisite':'prerequisite', 'not-enough-points':'insufficient-points', 'not-enough-seals':'insufficient-seals',
});
const has = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj,key);
export function createLocale(initial: Language = 'ru'): GameLocale {
 let language: Language = initial === 'en' ? 'en' : 'ru';
 const numeric = (value: number): string => Number.isFinite(value) ? new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {maximumFractionDigits: 2}).format(value) : '—';
 const text = (key: string, vars?: Record<string,string|number>): string => {
  const lookup = key.startsWith('hud.category.') || key.startsWith('hud.target.') ? key.slice(4) : key;
  const row = has(messages,lookup) ? messages[lookup as keyof typeof messages] : undefined;
  const template = row?.[language === 'ru' ? 0 : 1] || row?.[1] || row?.[0] || key;
  return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token: string, name: string) => {
   if (!vars || !has(vars,name)) return token;
   const value = vars[name]; return typeof value === 'number' ? numeric(value) : value;
  });
 };
 const reason = (raw?: string): string => {
  const normalized = (raw ?? '').trim().replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase().replace(/^reason[.:-]/,'').replace(/[\s_]+/g,'-');
  const key = `reason.${has(aliases,normalized) ? aliases[normalized] : normalized}`;
  return text(has(messages,key) ? key : 'reason.unknown');
 };
 return { get language(){return language;}, text, setLanguage(value){language=value==='en'?'en':'ru';}, number:numeric,
  count(unit,value){ const category=Number.isFinite(value) ? new Intl.PluralRules(language).select(value) : 'other'; return text(`unit.${unit}.${category}`,{count:value}); },
  wave(wave,total,endless=false){return text(endless?'hud.endlessWave':'hud.wave',{wave,total});}, reason,
  result(result){return result.pending ? text('reason.pending') : result.ok ? text('common.ok') : reason(result.reason);},
 };
}
