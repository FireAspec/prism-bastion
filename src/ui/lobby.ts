import type { GameConfig, LobbyHooks, LobbyUI, LocaleCatalog, Profile, RoomState, RunOptions, Difficulty } from '../contracts';
import './lobby.css';

/** Optional app-owned metadata absent from LobbyUI v1. No transport is created here. */
export interface LobbyContext {
  playerId?: string;
  maxPlayers?: 2 | 3 | 4;
  credits?: number;
  lives?: number;
  addresses?: readonly string[];
  port?: number;
}
export interface LobbyIntegration extends LobbyHooks { context?: () => LobbyContext; }
const PORT = 43127;
const strings = {
  title: ['Игра с друзьями', 'Play with friends'], sub: ['Совместная оборона маяка • 2–4 игрока', 'Defend the beacon together • 2–4 players'],
  create: ['Создать комнату', 'Create room'], join: ['Подключиться', 'Join room'], name: ['Имя игрока', 'Player name'],
  password: ['Пароль (необязательно)', 'Password (optional)'], port: ['Порт', 'Port'], address: ['Адрес хоста', 'Host address'],
  map: ['Карта', 'Map'], difficulty: ['Сложность', 'Difficulty'], mode: ['Режим', 'Mode'], capacity: ['Мест в комнате', 'Room capacity'],
  back: ['Назад', 'Back'], leave: ['Покинуть комнату', 'Leave room'], help: ['Как подключиться', 'Connection guide'],
  guide: ['В одной сети используйте IP хоста и порт. Для игры через интернет можно использовать бесплатную виртуальную LAN.', 'On the same network, use the host IP and port. For internet play, a free virtual LAN is an option.'],
  rules: ['Правила команды', 'Team rules'], wallet: ['Общий кошелёк', 'Shared wallet'], lives: ['Общие жизни', 'Shared lives'],
  ownership: ['Все строят на общей карте. Улучшать, продавать, менять цель и применять способность может владелец башни. После 30 секунд отключения хост может забрать осиротевшие башни.', 'Everyone builds on the same map. Only the owner can upgrade, sell, target or activate a tower. After 30 seconds offline, the host can claim orphaned towers.'],
  speed: ['Паузой и скоростью управляет хост. Новая волна — когда все готовы или по решению хоста. Слот T5 общий.', 'The host controls pause and speed. A new wave starts when everyone is ready or the host decides. T5 slots are shared.'],
  waiting: ['Ожидание игроков', 'Waiting for players'], ready: ['Готов', 'Ready'], notReady: ['Не готов', 'Not ready'], host: ['Хост', 'Host'],
  offline: ['Нет связи', 'Disconnected'], empty: ['Свободное место', 'Open slot'], unknown: ['Место не подтверждено', 'Slot not confirmed'],
  start: ['Начать игру', 'Start game'], force: ['Начать без полной готовности', 'Start before everyone is ready'],
  confirm: ['Подтвердить запуск', 'Confirm start'], cancel: ['Отмена', 'Cancel'], started: ['Игра началась', 'Game started'],
  connect: ['Подключение…', 'Connecting…'], creating: ['Создание комнаты…', 'Creating room…'],
  reconnect: ['Восстановление связи. Не выходите: ваш слот сохраняется до 120 секунд.', 'Reconnecting. Stay here: your slot is reserved for up to 120 seconds.'],
  expired: ['Время восстановления истекло. Вернитесь в меню и подключитесь заново.', 'Reconnect window expired. Return to the menu and join again.'],
  mismatch: ['Версии игры или данные контента не совпадают. Установите одинаковую версию игры у всех участников.', 'Game versions or content differ. Install the same game version on all computers.'],
  unreachable: ['Не удалось связаться с хостом. Проверьте IP, порт, что игра хоста запущена, и разрешение в брандмауэре. Для удалённой игры проверьте виртуальную LAN.', 'Cannot reach the host. Check IP, port, that the host game is running, and firewall permissions. For remote play, check the virtual LAN.'],
  badPassword: ['Неверный пароль комнаты.', 'Incorrect room password.'], full: ['В комнате нет свободных мест.', 'The room is full.'],
  failure: ['Операция не выполнена. Проверьте подключение и попробуйте снова.', 'Operation failed. Check the connection and try again.'],
  addresses: ['Адреса для друзей', 'Addresses for friends'], copy: ['Копировать', 'Copy'], copied: ['Адрес скопирован', 'Address copied'],
  manualCopy: ['Выделите адрес и нажмите Ctrl+C.', 'Select the address and press Ctrl+C.'], noAddresses: ['Адреса пока недоступны. Узнайте IPv4 хоста в настройках сети.', 'Addresses unavailable. Find the host IPv4 in network settings.'],
  invalidName: ['Введите имя от 1 до 24 символов без управляющих знаков.', 'Enter a name of 1–24 characters without control characters.'],
  invalidPort: ['Порт должен быть целым числом от 1 до 65535.', 'Enter an integer port from 1 to 65535.'],
  invalidAddress: ['Введите IPv4, IPv6 или имя компьютера; порт можно указать отдельно.', 'Enter an IPv4, IPv6 or hostname; specify the port separately.'],
  invalidPassword: ['Пароль не должен содержать управляющие знаки.', 'The password cannot contain control characters.'],
  invalidMap: ['Нет доступной карты или режима.', 'No available map or mode.'], noBalance: ['После запуска', 'After start'],
  noNat: ['Без аккаунтов и подписок. Автоматический обход NAT не предусмотрен.', 'No accounts or subscriptions. Automatic NAT traversal is not supported.'],
  notEnough: ['Нужно не менее двух подключённых игроков.', 'At least two connected players are required.'],
  pending: ['Ожидаем подтверждения сервера…', 'Waiting for server confirmation…'],
  waitingHost: ['Запуск подтверждает хост.', 'The host confirms the start.'],
  notDesktop: ['Создание комнаты доступно в настольной игре.', 'Hosting is available in the desktop game.'],
  reserved: ['Зарезервировано', 'Reserved'], passwordHint: ['Передайте пароль друзьям отдельно.', 'Share the password separately.'],
  clear: ['Пройдено', 'Cleared'],
} as const;
type Key = keyof typeof strings;
export function validName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 24 && !/[\x00-\x1f\x7f]/.test(value);
}
export function validPort(value: string): boolean {
  return /^\d{1,5}$/.test(value) && Number(value) >= 1 && Number(value) <= 65535;
}
/** Accept bare host, bracketed IPv6, or a ws URL without credentials/path/query. */
export function joinUrl(address: string, port: string): string | null {
  const raw = address.trim();
  if (!validPort(port) || !raw || /[\s\\@?#%]/.test(raw)) return null;
  let authority = raw.replace(/^ws:\/\//i, '');
  if (authority.endsWith('/')) authority = authority.slice(0, -1);
  if (authority.includes('/')) return null;
  if (!authority.startsWith('[') && (authority.match(/:/g) ?? []).length > 1) authority = `[${authority}]`;
  const match = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::(\d+))?$/i.exec(authority);
  if (!match || (match[2] !== undefined && !validPort(match[2]))) return null;
  const host = match[1];
  if (!host.startsWith('[')) {
    if (/^[\d.]+$/.test(host)) {
      if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.split('.').some(x => Number(x) > 255 || (x.length > 1 && x.startsWith('0')))) return null;
    } else if (host.length > 253 || !host.split('.').every(x => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(x))) return null;
  }
  try { return new URL(`ws://${host}:${Number(match[2] ?? port)}`).origin; } catch { return null; }
}
function errorKey(status: string): Key | null {
  const s = status.toLowerCase();
  if (/mismatch|digest|protocol.version|content.version|несовпад/.test(s)) return 'mismatch';
  if (/expired|timeout.*resume|resume.*timeout|истек/.test(s)) return 'expired';
  if (/reconnect|resum(e|ing)|восстановлен/.test(s)) return 'reconnect';
  if (/password|парол/.test(s)) return 'badPassword';
  if (/room.full|capacity|комната заполнена/.test(s)) return 'full';
  if (/offline|firewall|disconnect|refused|unreachable|network|timeout|closed|failed to fetch|брандмауэр|отключ/.test(s)) return 'unreachable';
  if (/error|fail|reject|ошиб/.test(s)) return 'failure';
  return null;
}
export function createLobby(root: HTMLElement, config: GameConfig, hooks: LobbyIntegration, locale?: LocaleCatalog): LobbyUI {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  let profile: Profile | undefined, room: RoomState | undefined, status = '', role: 'host'|'guest'|null = null;
  let visible = false, disposed = false, busy = false, pending = false, generation = 0, actionTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingCheck: ((r: RoomState)=>boolean) | undefined;
  let notice: Key | null = null;
  let active: 'host'|'guest' = 'host', addresses: string[] = [], hostedPort = PORT, capacity: 2|3|4 = 4;
  let language: 'ru'|'en' = 'ru', focusBefore: HTMLElement | null = null;
  const draft = { name: '', address: '', port: String(PORT), map: '', difficulty: 'normal', mode: 'standard' };
  const t = (key: Key): string => {
    const k = `lobby.${key}`; const translated = locale?.text(k);
    return translated && translated !== k ? translated : strings[key][language === 'en' ? 1 : 0];
  };
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag); node.textContent = text; if (cls) node.className = cls; return node;
  }
  const panel = el('section', '', 'pb-lobby'); panel.setAttribute('aria-label', t('title')); panel.hidden = true;
  root.append(panel);
  const header = el('header', '', 'pb-lobby__header'); const body = el('div', '', 'pb-lobby__body');
  const message = el('p', '', 'pb-lobby__message'); message.setAttribute('role', 'status'); message.setAttribute('aria-live','polite'); message.hidden = true;
  panel.append(header, message, body);
  function button(text: string, action: () => void, primary = false): HTMLButtonElement {
    const b = el('button', text, primary ? 'pb-lobby__primary' : ''); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function say(key: Key | null): void { notice = key; const text = key ? t(key) : ''; if (message.textContent !== text) message.textContent = text; message.hidden = !key; }
  function context(): LobbyContext { return hooks.context?.() ?? {}; }
  function resetPending(): void { pending = false; pendingCheck = undefined; if (actionTimer !== undefined) clearTimeout(actionTimer); actionTimer = undefined; }
  function leave(): void {
    generation++; resetPending(); busy = false; role = null; room = undefined; status = ''; addresses = []; say(null);
    try { hooks.leave(); } finally { hide(); }
  }
  function hide(): void {
    visible = false; generation++; resetPending(); busy = false; role = null; room = undefined; status = ''; addresses = [];
    panel.hidden = true; header.replaceChildren(); body.replaceChildren(); say(null);
    if (focusBefore?.isConnected) focusBefore.focus(); focusBefore = null;
  }
  function heading(inRoom: boolean): void {
    header.replaceChildren(); const title = el('div'); title.append(el('p', 'PRISM BASTION / CO-OP', 'pb-lobby__eyebrow'), el('h1', t('title')), el('p', t('sub')));
    const back = button(t(inRoom ? 'leave' : 'back'), leave); back.dataset.focus = 'back'; header.append(title, back);
  }
  function rules(): HTMLElement {
    const aside = el('aside', '', 'pb-lobby__aside'); aside.append(el('h2', t('rules')), el('p', t('ownership')), el('p', t('speed')));
    const details = el('details'); details.append(el('summary', t('help')), el('p', t('guide')));
    const link = el('a', 'Radmin VPN ↗'); link.href = 'https://www.radmin-vpn.com/'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    details.append(link, el('p', t('noNat'))); aside.append(details); return aside;
  }
  function availableMaps(): GameConfig['maps'] {
    const completed = new Set(profile?.completedNodes ?? []);
    return config.maps.filter(m => { const n = config.campaign.find(x => x.mapId === m.id); return !n || n.prerequisites.every(x => completed.has(x)); });
  }
  function availableModes(mapId: string): GameConfig['modes'] {
    const node = config.campaign.find(n => n.mapId === mapId);
    return config.modes.filter(m => !m.requiresClear || !!node && !!profile?.completedNodes.includes(node.id));
  }
  function renderForm(): void {
    if (!visible || disposed) return;
    heading(false); body.replaceChildren(); body.className = 'pb-lobby__body pb-lobby__split';
    const left = el('div', '', 'pb-lobby__surface'); const switches = el('div', '', 'pb-lobby__switches');
    for (const mode of ['host','guest'] as const) { const b = button(t(mode === 'host' ? 'create' : 'join'), () => { active = mode; say(null); renderForm(); body.querySelector<HTMLInputElement>('input')?.focus(); }); b.disabled = busy; b.setAttribute('aria-pressed', String(active === mode)); switches.append(b); }
    const form = el('form'); form.noValidate = true;
    
    function field(key: Key, value: string, type = 'text', change?: (s: string)=>void): HTMLInputElement {
      const label = el('label', '', 'pb-lobby__field'); const input = el('input'); input.type = type; input.name = key; input.value = value;
      input.disabled = busy; input.autocomplete = type === 'password' ? 'new-password' : 'off';
      label.append(el('span', t(key)), input); form.append(label);
      input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); change?.(input.value); }); return input;
    }
    function select(key: Key, values: readonly {id:string;name:string}[], current: string, change: (s:string)=>void): HTMLSelectElement {
      const label = el('label', '', 'pb-lobby__field'); const input = el('select'); input.name = key; input.disabled = busy;
      for (const v of values) { const o = el('option', v.name); o.value = v.id; input.append(o); }
      input.value = values.some(v => v.id === current) ? current : values[0]?.id ?? ''; change(input.value);
      input.addEventListener('change', () => change(input.value)); label.append(el('span', t(key)), input); form.append(label); return input;
    }
    const name = field('name', draft.name, 'text', s => draft.name = s); name.maxLength = 24;
    const address = active === 'guest' ? field('address', draft.address, 'text', s => draft.address = s) : undefined;
    if (address) address.placeholder = '192.168.1.10';
    const port = field('port', draft.port, 'text', s => draft.port = s); port.inputMode = 'numeric';
    const password = field('password', '', 'password');
    if (active === 'host') {
      const maps = availableMaps();
      const mapSelect = select('map', maps, draft.map, s => draft.map = s);
      select('difficulty', config.difficulties, draft.difficulty, s => draft.difficulty = s);
      const modes = select('mode', availableModes(draft.map), draft.mode, s => draft.mode = s);
      mapSelect.addEventListener('change', () => {
        modes.replaceChildren(); for (const m of availableModes(draft.map)) { const o = el('option', m.name); o.value = m.id; modes.append(o); }
        modes.value = availableModes(draft.map).some(m => m.id === draft.mode) ? draft.mode : modes.options[0]?.value ?? ''; draft.mode = modes.value;
      });
      select('capacity', [2,3,4].map(n => ({id:String(n),name:String(n)})), String(capacity), s => capacity = Number(s) as 2|3|4);
    }
    const submit = el('button', t(active === 'host' ? 'create' : 'join'), 'pb-lobby__primary'); submit.type = 'submit'; submit.disabled = busy; form.append(submit);
    function invalid(input: HTMLInputElement, key: Key): void { input.setAttribute('aria-invalid','true'); say(key); input.focus(); }
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !visible || disposed) return;
      if (!validName(name.value)) return invalid(name,'invalidName');
      if (!validPort(port.value)) return invalid(port,'invalidPort');
      if (/[\x00-\x1f\x7f]/.test(password.value)) return invalid(password,'invalidPassword');
      const url = address ? joinUrl(address.value,port.value) : null;
      if (address && !url) return invalid(address,'invalidAddress');
      if (!address && (!availableMaps().some(m=>m.id===draft.map) || !availableModes(draft.map).some(m=>m.id===draft.mode))) return say('invalidMap');
      const secret = password.value; password.value = ''; const operation = ++generation;
      role = active; busy = true; hostedPort = Number(port.value); say(active === 'host' ? 'creating' : 'connect');
      for (const input of form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLButtonElement>('input,select,button')) input.disabled = true;
      for (const b of switches.querySelectorAll('button')) b.disabled = true;
      try {
        if (active === 'host') {
          const seed = win?.crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now() >>> 0;
          const run: RunOptions = {mapId:draft.map,difficulty:draft.difficulty as Difficulty,seed,endless:false,modeId:draft.mode,unlockedTowers:[...(profile?.unlockedTowers ?? [])],players:[],runId:win?.crypto.randomUUID?.() ?? `run-${Date.now()}-${seed}`,knowledge:[...(profile?.knowledgeUnlocked ?? [])]};
          await hooks.host({name:name.value.trim(),port:hostedPort,maxPlayers:capacity,password:secret}, run);
          if (operation !== generation || !visible) return;
          let discovered: string[] = [];
          try { discovered = await win?.prismDesktop?.getAddresses() ?? []; } catch { /* optional bridge */ }
          if (operation !== generation || !visible) return; addresses = discovered;
        } else await hooks.join(url!,name.value.trim(),secret);
        if (operation !== generation || !visible) return;
        // A resolved hook is not a room acknowledgement. update() supplies it.
        if (room) { busy = false; renderRoom(); }
      } catch (error) {
        if (operation !== generation || !visible) return;
        busy = false; role = null; room = undefined; renderForm(); say(errorKey(String(error)) ?? 'failure');
      }
    });
    left.append(switches,form); body.append(left,rules());
  }
  async function copy(input: HTMLInputElement): Promise<void> {
    const token = generation;
    try { if (!win?.navigator.clipboard) throw new Error(); await win.navigator.clipboard.writeText(input.value); if (token === generation && visible) say('copied'); return; } catch { /* fall through */ }
    if (token !== generation || !visible || !input.isConnected) return;
    input.focus(); input.select(); let ok = false; try { ok = doc.execCommand('copy'); } catch { /* manual copy remains available */ }
    say(ok ? 'copied' : 'manualCopy');
  }
  function action(fn: ()=>void, acknowledged: (r: RoomState)=>boolean): void {
    if (pending || disposed || !visible) return;
    pending = true; pendingCheck = acknowledged; say('pending');
    actionTimer = setTimeout(() => { resetPending(); if (visible && room) { renderRoom(); say('failure'); } }, 5000);
    try { fn(); } catch { resetPending(); say('failure'); }
    if (room) renderRoom();
  }
  function renderRoom(): void {
    if (!visible || !room || disposed) return;
    const r = room; const meta = context(); const host = meta.playerId ? meta.playerId === r.hostId : role === 'host';
    const self = meta.playerId ?? (host ? r.hostId : undefined);
    const mismatch = r.contentDigest !== config.contentDigest || r.protocolVersion !== 1;
    const issue = mismatch ? 'mismatch' : errorKey(status);
    const blocked = !!issue;
    const helpOpen = body.querySelector('details')?.open ?? false;
    const previous = doc.activeElement instanceof HTMLElement && panel.contains(doc.activeElement) ? doc.activeElement.dataset.focus : undefined;
    heading(true); body.replaceChildren(); body.className = 'pb-lobby__body pb-lobby__split';
    const main = el('div','','pb-lobby__surface');
    main.append(el('p',r.started ? t('started') : t('waiting'),'pb-lobby__eyebrow'),el('h2',r.name));
    const map = config.maps.find(m=>m.id===r.options.mapId)?.name ?? r.options.mapId;
    const difficulty = config.difficulties.find(d=>d.id===r.options.difficulty)?.name ?? r.options.difficulty;
    const mode = config.modes.find(m=>m.id===r.options.modeId)?.name ?? r.options.modeId;
    main.append(el('p',`${map} · ${difficulty} · ${mode}`));
    const slots = el('ul','','pb-lobby__slots');
    for (const p of r.players) {
      const item = el('li'); const who = el('span',p.name,'pb-lobby__player'); if (p.id===r.hostId) who.append(el('small',t('host')));
      const state = !p.connected ? t('offline') : r.ready.includes(p.id) ? t('ready') : t('notReady');
      item.append(who,el('strong',state,p.connected && r.ready.includes(p.id) ? 'pb-lobby__ready' : '')); slots.append(item);
    }
    const max = meta.maxPlayers ?? (host ? capacity : undefined);
    for (let i=r.players.length;i<(max ?? 4);i++) { const item=el('li',t(max ? 'empty' : 'unknown'),'pb-lobby__empty'); slots.append(item); }
    main.append(slots);
    const metrics = el('div','','pb-lobby__metrics');
    for (const [key,value] of [['wallet',meta.credits],['lives',meta.lives]] as const) { const card = el('div'); card.append(el('span',t(key)),el('strong',value===undefined ? '—' : String(value))); metrics.append(card); }
    main.append(metrics);
    if (host) {
      const list = el('div','','pb-lobby__addresses'); list.append(el('h3',t('addresses')));
      const usable = [...new Set(meta.addresses ?? addresses)].map(a=>joinUrl(a,String(meta.port ?? hostedPort))).filter((a): a is string => !!a);
      if (!usable.length) list.append(el('p',t('noAddresses')));
      for (const a of usable) { const row=el('div','','pb-lobby__address'); const input=el('input'); input.readOnly=true; input.value=a.replace(/^ws:\/\//,''); input.setAttribute('aria-label',t('address')); input.dataset.focus=a;
        const b=button(t('copy'),()=>void copy(input)); b.dataset.focus=`copy-${a}`; row.append(input,b); list.append(row); }
      main.append(list);
    }
    const controls=el('div','','pb-lobby__controls');
    if (!r.started) {
      for (const value of [true,false]) { const b=button(t(value?'ready':'notReady'),()=>action(()=>hooks.ready(value), next => self ? next.ready.includes(self) === value : false),value); b.dataset.focus=value?'ready':'not-ready'; b.disabled=blocked||pending||(self!==undefined && r.ready.includes(self)===value); controls.append(b); }
      if (host) {
        const connected=r.players.filter(p=>p.connected); const all=r.players.every(p=>p.connected&&r.ready.includes(p.id));
        const start=button(t(all?'start':'force'),()=>{
          if (all) action(hooks.start, next => next.started); else { const confirm=el('div','','pb-lobby__confirm'); const yes=button(t('confirm'),()=>action(hooks.start, next => next.started),true); confirm.append(yes,button(t('cancel'),()=>{confirm.remove();start.disabled=false;start.focus();})); start.disabled=true; controls.append(confirm); yes.focus(); }
        },true); start.dataset.focus='start'; start.disabled=blocked||pending||connected.length<2; controls.append(start);
        if (connected.length<2) controls.append(el('p',t('notEnough')));
      } else controls.append(el('p',t('waitingHost')));
    }
    main.append(controls); const aside = rules(); const details=aside.querySelector('details'); if (details) details.open=helpOpen; body.append(main,aside);
    if (issue) say(issue); else if (pending) say('pending'); else if (notice && !['copied','manualCopy','failure'].includes(notice)) say(null);
    if (previous) [...panel.querySelectorAll<HTMLElement>('[data-focus]')].find(e=>e.dataset.focus===previous)?.focus();
  }
  return {
    show(p) { if (disposed) return; if (visible) return; profile=p; language=p.settings.language; panel.lang=language; panel.setAttribute('aria-label',t('title')); focusBefore=doc.activeElement instanceof HTMLElement ? doc.activeElement : null; visible=true; panel.hidden=false; renderForm(); body.querySelector<HTMLInputElement>('input')?.focus(); },
    update(r,s) { if (disposed || !visible) return; const changed=status!==s; room=r; status=s; busy=false; if (pending && (pendingCheck?.(r) || errorKey(s))) resetPending(); if (changed && !errorKey(s)) say(null); renderRoom(); },
    hide,
    dispose() { if (disposed) return; hide(); disposed=true; panel.remove(); },
  };
}
