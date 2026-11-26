import type {CampaignNode, Difficulty, GameConfig, GameState, LocaleCatalog, MapDef, MenuHooks, MenuUI, ModeDef, Profile, RewardReceipt, RuleModifiers, Settings} from '../contracts';
import './menus.css';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'extreme'];
const GROUPS = [['Начальные', 'Beginner'], ['Средние', 'Intermediate'], ['Сложные', 'Advanced'], ['Экспертные', 'Expert']];
const svgNS = 'http://www.w3.org/2000/svg';
const asset = (path: string) => path.replace(/^\/?public\//, '/');
const isClear = (profile: Profile, node: CampaignNode) => profile.completedNodes.includes(node.id);

/** Preview only. The runtime owns final knowledge modifiers and all rewards. */
export function menuRules(config: GameConfig, difficulty: Difficulty, mode: ModeDef): RuleModifiers | undefined {
  const d = config.difficulties.find(x => x.id === difficulty);
  if (!d) return undefined;
  return {incomeMul: 1, startingCashMul: 1, enemyHpMul: d.enemyHpMul, enemySpeedMul: 1,
    towerCostMul: d.towerCostMul, sellAllowed: true, maxLives: d.lives, allowAbilities: true,
    allowPassiveIncome: true, maxTowers: 60, maxTier: 5, weather: 'none', allowKnowledge: true,
    rounds: d.rounds, roundRewardBase: d.roundRewardBase, roundRewardStep: d.roundRewardStep,
    popCashMul: d.popCashMul, ...mode.modifiers};
}

export function createMenus(root: HTMLElement, config: GameConfig, hooks: MenuHooks, locale?: LocaleCatalog): MenuUI {
  const host = document.createElement('section');
  host.className = 'pb-menu'; root.append(host);
  host.hidden = true;
  let profile: Profile;
  let run: GameState | null = null;
  let receipt: RewardReceipt | undefined;
  let screen: Parameters<MenuUI['show']>[0] = 'title';
  let mapId = '', difficulty: Difficulty = 'easy', modeId = 'standard';
  let settings: Settings;
  let disposed = false, launching = false;
  let notice = '';
  const maps = [...config.maps].sort((a,b) => a.campaignIndex - b.campaignIndex);
  const nodeFor = (id: string) => config.campaign.find(n => n.mapId === id);
  const missing = (node?: CampaignNode) => node?.prerequisites.filter(id => !profile.completedNodes.includes(id)) ?? [];
  const open = (id: string) => !!nodeFor(id) && missing(nodeFor(id)).length === 0;
  const ru = () => settings.language === 'ru';
  const t = (a: string, b: string) => ru() ? a : b;
  const label = (key: string, a: string, b: string) => {
    const value = locale?.text(`menus.${key}`);
    return value && value !== `menus.${key}` ? value : t(a,b);
  };
  const num = (n: number) => n.toLocaleString(ru() ? 'ru-RU' : 'en-US', {maximumFractionDigits: 2});
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
    const e = document.createElement(tag); e.className = cls; e.textContent = text; return e;
  };
  const add = (parent: HTMLElement, ...children: HTMLElement[]) => parent.append(...children);
  const button = (text: string, action: () => void, cls = '', disabled = false, key = '') => {
    const b = el('button', cls, text); b.type = 'button'; b.disabled = disabled;
    if (key) b.dataset.focus = key;
    b.addEventListener('click', () => {
      try { action(); } catch (error) { notice = String(error instanceof Error ? error.message : error); render(); }
    }); return b;
  };
  const heading = (parent: HTMLElement, text: string, sub?: string) => {
    parent.append(el('h1', '', text)); if (sub) parent.append(el('p', 'pb-muted', sub));
  };
  const navigate = (next: typeof screen) => { screen = next; notice = ''; host.scrollTop=0; render(); host.querySelector<HTMLElement>('button:not(:disabled)')?.focus({preventScroll:true}); };
  const towerName = (id: string) => config.towers.find(x => x.id === id)?.name ?? id;
  const difficultyName = (id: Difficulty) => t(['Лёгкая','Обычная','Трудная','Экстремальная'][DIFFICULTIES.indexOf(id)], ['Easy','Normal','Hard','Extreme'][DIFFICULTIES.indexOf(id)]);
  const nodeName = (id: string) => config.campaign.find(n => n.id === id)?.title ?? id;
  const activeRun = () => run && (run.phase === 'build' || run.phase === 'wave');
  const call = (fn: () => void) => { notice = ''; fn(); };
  const back = () => button(t('← Главное меню','← Main menu'), () => navigate('title'), 'pb-quiet', false, 'back');

  function thumbnail(map: MapDef): HTMLElement {
    const figure = el('div','pb-thumb'); figure.dataset.theme = map.theme;
    const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox','0 0 1280 720'); svg.setAttribute('aria-hidden','true');
    const shape = (tag: 'polygon'|'polyline', points: {x:number;y:number}[], fill: string, stroke: string, width: number) => {
      const s = document.createElementNS(svgNS,tag); s.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
      s.setAttribute('fill',fill); s.setAttribute('stroke',stroke); s.setAttribute('stroke-width',String(width));
      s.setAttribute('stroke-linejoin','round'); s.setAttribute('stroke-linecap','round'); svg.append(s);
    };
    for (const p of map.water) shape('polygon',p,'#287b92','#65b6c6',8);
    for (const p of map.blocked) shape('polygon',p,'#38434a','#85918b',8);
    for (const lane of map.lanes) { shape('polyline',lane,'none','#362b27',map.pathWidth+14); shape('polyline',lane,'none','#dcb57b',map.pathWidth); }
    figure.append(svg);
    if (map.background) {
      const img = el('img'); img.alt = ''; img.loading = 'lazy';
      img.addEventListener('error', () => img.remove(), {once:true});
      img.src = asset(map.background); figure.append(img);
    }
    return figure;
  }

  function titlePage(body: HTMLElement) {
    const hero = el('div','pb-hero'); const crest = el('div','pb-crest','✦'); crest.setAttribute('aria-hidden','true');
    add(hero, crest, el('p','pb-kicker','PRISM BASTION'), el('h1','',t('Зажги маяки','Rekindle the beacons')), el('p','pb-lead',t('Двадцать рубежей. Одна сеть света. Верни миру спокойствие после кристаллической бури.','Twenty frontiers. One network of light. Restore the world after the crystal storm.')));
    const actions = el('div','pb-actions');
    add(actions, button(label('campaign','Кампания','Campaign'), () => navigate('maps'),'pb-primary',false,'campaign'),
      button(t('Продолжить забег','Resume run'), () => call(hooks.resume),'',!activeRun(),'resume'),
      button(t('Кооператив','Co-op'), () => call(hooks.coop),'',false,'coop'),
      button(t('Пять доктрин','Five doctrines'), () => call(hooks.knowledge),'',false,'knowledge'),
      button(t('Настройки','Settings'), () => navigate('settings'),'',false,'settings'), button(t('Справка','Help'), () => navigate('help'),'',false,'help'));
    add(hero,actions,el('p','pb-muted',t('Восстановлено: ','Restored: ')+`${config.campaign.filter(n => isClear(profile,n)).length} / ${maps.length}`));
    body.append(hero);
  }

  function mapsPage(body: HTMLElement) {
    add(body,back()); heading(body,t('Кампания маяков','Beacon campaign'),t('Группа карты описывает геометрию. Сложность забега выбирается отдельно.','Map groups describe geometry. Run difficulty is a separate choice.'));
    const layout = el('div','pb-layout'), grid = el('div','pb-map-groups'), detail = el('aside','pb-detail');
    for (let group=1;group<=4;group++) {
      const section = el('section','pb-group'), cards = el('div','pb-grid');
      section.append(el('h2','',`${group.toString().padStart(2,'0')} · ${t(GROUPS[group-1][0],GROUPS[group-1][1])}`));
      for (const map of maps.filter(m => m.difficulty === group)) {
        const node = nodeFor(map.id), available = open(map.id), done = !!node && isClear(profile,node);
        const card = button('', () => { mapId = map.id; notice = ''; render(); },'pb-map',false,`map-${map.id}`);
        card.setAttribute('aria-pressed',String(mapId === map.id));
        card.append(thumbnail(map),el('span','pb-map-name',map.name),el('span','pb-map-status',done ? t('✓ Пройдено','✓ Cleared') : available ? t('Доступна','Available') : t('Закрыта','Locked')));
        if (!available) card.classList.add('pb-locked'); cards.append(card);
      }
      section.append(cards); grid.append(section);
    }
    const map = maps.find(m => m.id === mapId);
    if (!map) detail.append(el('p','',t('Нет доступных данных карт.','Map data unavailable.')));
    else {
      const node = nodeFor(map.id), available = open(map.id), cleared = !!node && isClear(profile,node);
      add(detail,el('h2','',map.name),thumbnail(map),el('p','pb-muted',map.description),el('p','',node?.briefing ?? ''),
        el('p','pb-tag',t('Рекомендация: ','Recommended: ')+difficultyName(map.recommendedDifficulty)));
      if (!available) detail.append(el('p','pb-warning',node ? t('Сначала пройди: ','Complete first: ')+missing(node).map(nodeName).join(', ') : t('Нет сюжетного узла.','Campaign node unavailable.')));
      const rewards = el('div','pb-rewards'); rewards.append(el('h3','',t('Сюжетная награда','Story reward')));
      for (const id of node?.unlocks ?? []) rewards.append(el('span','pb-tag',`${profile.unlockedTowers.includes(id) ? '✓' : '◇'} ${towerName(id)}`));
      if (!node?.unlocks.length) rewards.append(el('p','pb-muted',t('Завершение сюжетного узла','Campaign node completion')));
      detail.append(rewards);
      const field = el('fieldset','pb-choice'); field.append(el('legend','',t('Сложность забега','Run difficulty')));
      for (const id of DIFFICULTIES) {
        const d = config.difficulties.find(x=>x.id===id);
        const b = button(`${difficultyName(id)}${d ? ` · ${d.rounds}` : ''}`,() => {difficulty=id;render();},'',!d,`difficulty-${id}`);
        b.setAttribute('aria-pressed',String(difficulty===id));field.append(b);
      }
      detail.append(field);
      const modes = el('select'); modes.dataset.focus='mode'; modes.setAttribute('aria-label',t('Режим испытания','Challenge mode'));
      const chosen = config.modes.find(m=>m.id===modeId);
      if (!chosen) modeId=config.modes.find(m=>m.id==='standard')?.id ?? config.modes[0]?.id ?? '';
      for (const m of config.modes) {
        const o=el('option','',m.name+(m.requiresClear&&!cleared?t(' — закрыт',' — locked'):'')); o.value=m.id;o.disabled=m.requiresClear&&!cleared;modes.append(o);
      }
      modes.value=modeId; modes.addEventListener('change',()=>{modeId=modes.value;render();});
      const mode=config.modes.find(m=>m.id===modeId);
      add(detail,el('h3','',t('Режим испытания','Challenge mode')),modes,el('p','pb-muted',mode?.description??''));
      if (mode?.requiresClear&&!cleared) detail.append(el('p','pb-warning',t('Сначала пройди эту карту в стандартном режиме.','Clear this map in standard mode first.')));
      const d=config.difficulties.find(x=>x.id===difficulty), rules=mode&&menuRules(config,difficulty,mode);
      if (d&&rules&&mode) {
        const metrics=el('dl','pb-metrics');
        const metric=(name:string,value:string|number)=>add(metrics,el('dt','',name),el('dd','',String(value)));
        metric(t('Волны','Waves'),rules.rounds); metric(t('Жизни','Lives'),rules.maxLives); metric(t('Стартовые кредиты','Starting credits'),num(Math.floor(d.startCredits*rules.startingCashMul)));
        metric(t('Цены','Prices'),`×${num(rules.towerCostMul)}`);metric(t('HP врагов','Enemy HP'),`×${num(rules.enemyHpMul)}`);
        metric(t('Доход','Income'),`×${num(rules.incomeMul)}`);metric(t('Награда волны n','Wave reward n'),`(${rules.roundRewardBase} + ${rules.roundRewardStep}n) ×${num(rules.incomeMul)}`);
        const rewardMul=d.rewardMul*(config.economy.modeReward[mode.id]??1);
        metric(t('Опыт / печати','XP / seals'),`×${num(rewardMul)}`);
        const baseXP=config.economy.mapXP?.[map.difficulty-1],baseSeals=config.economy.mapSeals?.[map.difficulty-1];
        if(baseXP!==undefined&&baseSeals!==undefined){
          metric(t('Первая медаль: XP / печати','First medal: XP / seals'),`${num(Math.floor(baseXP*rewardMul*config.economy.firstClearXP))} / ${num(Math.floor(baseSeals*rewardMul))}`);
          metric(t('Повтор: XP / печати','Repeat: XP / seals'),`${num(Math.floor(baseXP*rewardMul*config.economy.repeatXP))} / ${num(Math.floor(baseSeals*rewardMul*config.economy.repeatSeals))}`);
        }
        metric(t('Лимит башен / тир','Tower limit / tier'),`${rules.maxTowers} / ${rules.maxTier}`);
        metric(t('Продажа / способности','Sell / abilities'),`${rules.sellAllowed?t('да','yes'):t('нет','no')} / ${rules.allowAbilities?t('да','yes'):t('нет','no')}`);
        add(detail,metrics,el('p','pb-muted',t('До знаний и кооперативных коэффициентов. Фактическая награда зависит от медали и профиля.','Before knowledge and co-op modifiers. Actual rewards depend on medal and profile.')));
      }
      const blocked = !available||!mode||!rules||!!(mode.requiresClear&&!cleared)||launching;
      detail.append(button(t('Начать оборону','Start defense'),()=>{
        if (blocked||launching||!mode||!rules) return;
        launching=true;render();
        try { const seed=crypto.getRandomValues(new Uint32Array(1))[0];
          hooks.start({mapId:map.id,difficulty,modeId:mode.id,seed,endless:false,unlockedTowers:[...profile.unlockedTowers],players:[{id:'local',name:t('Игрок','Player'),color:'#e4b46b',connected:true}],runId:typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint32Array(4)),v=>v.toString(16).padStart(8,'0')).join('-'),knowledge:rules.allowKnowledge?[...profile.knowledgeUnlocked]:[]});
        } catch(error) {launching=false;throw error;}
      },'pb-primary',blocked,'start'));
    }
    add(layout,grid,detail);body.append(layout);
  }

  function settingsPage(body: HTMLElement) {
    add(body,back());heading(body,t('Настройки','Settings'));
    const panel=el('div','pb-panel');
    const change=(patch:Partial<Settings>, rerender=true)=>{const next={...settings,...patch};hooks.settings(next);settings=next;locale?.setLanguage(settings.language);host.dataset.motion=String(!settings.reducedMotion);if(rerender)render();};
    for (const [key,title] of [['master',t('Общая громкость','Master volume')],['music',t('Музыка','Music')],['sfx',t('Эффекты','Effects')]] as const) {
      const row=el('label','pb-setting',title), input=el('input'), output=el('output','',`${Math.round(settings[key]*100)}%`);
      input.type='range';input.min='0';input.max='1';input.step='0.01';input.value=String(settings[key]);input.dataset.focus=key;
      input.addEventListener('change',()=>{try{change({[key]:Number(input.value)},false);output.textContent=`${Math.round(settings[key]*100)}%`;}catch(e){notice=String(e);render();}});add(row,input,output);panel.append(row);
    }
    for(const [key,title] of [['fullscreen',t('Полноэкранный режим','Fullscreen')],['reducedMotion',t('Уменьшить движение','Reduce motion')],['colorblind',t('Дополнительные обозначения цветов','Colorblind indicators')]] as const){
      const row=el('label','pb-setting',title), input=el('input');input.type='checkbox';input.checked=settings[key];input.dataset.focus=key;
      input.addEventListener('change',()=>{try{change({[key]:input.checked});}catch(e){notice=String(e);render();}});row.append(input);panel.append(row);
    }
    for(const [key,title,values] of [['language',t('Язык','Language'),['ru','en']],['quality',t('Качество эффектов','Effect quality'),['low','high']]] as const){
      const row=el('label','pb-setting',title),select=el('select');select.dataset.focus=key;for(const value of values){const o=el('option','',value);o.value=value;select.append(o);}select.value=settings[key];
      select.addEventListener('change',()=>{try{if(key==='language')change({language:select.value==='en'?'en':'ru'});else change({quality:select.value==='low'?'low':'high'});}catch(e){notice=String(e);render();}});row.append(select);panel.append(row);
    }
    panel.append(button(t('Экспорт профиля','Export profile'),()=>{if(!hooks.exportProfile)return;const url=URL.createObjectURL(new Blob([hooks.exportProfile()],{type:'application/json'}));const a=el('a');a.href=url;a.download='prism-bastion-profile.json';a.click();URL.revokeObjectURL(url);},'',!hooks.exportProfile,'export'));
    const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;panel.append(file);
    file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f||!hooks.importProfile)return;try{const result=hooks.importProfile(await f.text());if(disposed)return;notice=result.ok?t('Профиль импортирован.','Profile imported.'):result.reason??t('Ошибка импорта','Import failed');render();}catch(e){if(!disposed){notice=String(e);render();}}});
    panel.append(button(t('Импорт профиля','Import profile'),()=>file.click(),'',!hooks.importProfile,'import'));body.append(panel);
  }

  function resultsPage(body: HTMLElement) {
    const won=screen==='victory', map=maps.find(m=>m.id===run?.options.mapId), node=map&&nodeFor(map.id);
    add(body,back());heading(body,won?t('Маяк зажжён','Beacon rekindled'):t('Маяк погас','Beacon extinguished'),map?.name);
    const panel=el('div','pb-panel pb-result');
    if(run) panel.append(el('p','pb-tag',`${difficultyName(run.options.difficulty)} · ${config.modes.find(m=>m.id===run?.options.modeId)?.name??run.options.modeId} · ${run.wave} / ${run.rules.rounds}`));
    if(!receipt) panel.append(el('p','pb-muted',t('Подтверждённой награды нет.','No confirmed reward.')));
    else if(receipt.duplicate) panel.append(el('p','pb-tag',t('Результат уже обработан. Повторного начисления нет.','Result already processed. No additional award.')));
    else {
      panel.append(el('h2','',won?(receipt.firstClear?t('Первая медаль','First medal'):t('Повторная медаль','Repeat medal')):t('Итог забега','Run result')));
      const metrics=el('dl','pb-metrics');for(const [name,value] of [[t('Опыт','XP'),`+${num(receipt.xp)}`],[t('Печати','Seals'),`+${num(receipt.seals)}`],[t('Очки доктрин','Doctrine points'),`+${num(receipt.points)}`],[t('Уровень','Level'),`${receipt.levelBefore} → ${receipt.levelAfter}`]])add(metrics,el('dt','',name),el('dd','',value));panel.append(metrics);
    }
    if(won&&node){
      if(isClear(profile,node)) panel.append(el('p','pb-lead',node.outro));
      const newly=receipt&&!receipt.duplicate&&run ? node.unlocks.filter(id=>profile.unlockedTowers.includes(id)&&!run!.options.unlockedTowers.includes(id)):[];
      if(newly.length) panel.append(el('h3','',t('Новые технологии','New technologies')),el('p','',newly.map(towerName).join(' · ')));
      else if(node.unlocks.length)panel.append(el('p','pb-muted',t('Технологии узла: ','Node technologies: ')+node.unlocks.map(id=>`${profile.unlockedTowers.includes(id)?'✓':'◇'} ${towerName(id)}`).join(' · ')));
    }
    add(panel,button(t('К карте кампании','Campaign map'),()=>navigate('maps'),'pb-primary',false,'campaign'),button(t('Доктрины','Doctrines'),()=>call(hooks.knowledge),'',false,'knowledge'));body.append(panel);
  }

  function render() {
    if(disposed||host.hidden)return;
    const focus=(document.activeElement instanceof HTMLElement&&host.contains(document.activeElement))?document.activeElement.dataset.focus:undefined;
    const scroll=host.scrollTop;host.replaceChildren();host.dataset.motion=String(!settings.reducedMotion);
    const header=el('header','pb-header');add(header,el('strong','','PRISM ◇ BASTION'),el('span','',`${t('Уровень','Level')} ${profile.level} · ${num(profile.seals)} ${t('печатей','seals')} · ${num(profile.knowledgePoints)} ${t('очков','points')}`));
    const body=el('main','pb-body');add(host,header,body);
    if(notice){const msg=el('p','pb-warning',notice);msg.setAttribute('role','status');body.append(msg);}
    switch(screen){case 'title':titlePage(body);break;case 'maps':mapsPage(body);break;case 'settings':settingsPage(body);break;case 'victory':case 'defeat':resultsPage(body);break;case 'help':add(body,back());heading(body,t('Полевой справочник','Field guide'));for(const [a,b] of [['Строй башни вне дорожек. Водные технологии требуют воды.','Build towers outside paths. Water technologies need water.'],['У каждой башни три ветки; допустимы сочетания до 5–2–0.','Each tower has three paths; combinations up to 5–2–0 are legal.'],['Заверши стандартный забег, чтобы открыть следующую карту и испытания.','Clear a standard run to unlock the next map and challenges.'],['Кооператив: один хост, общий бюджет и жизни, 2–4 игрока.','Co-op: one host, shared budget and lives, 2–4 players.']])body.append(el('p','pb-panel',t(a,b)));break;}
    host.scrollTop=scroll;
    if(focus)Array.from(host.querySelectorAll<HTMLElement>('[data-focus]')).find(e=>e.dataset.focus===focus&&!e.matches(':disabled'))?.focus({preventScroll:true});
  }
  return {
    show(next,p,saved=null,reward){if(disposed)return;const wasHidden=host.hidden; if(wasHidden||next!==screen)launching=false;
      screen=next;profile=p;run=saved;receipt=reward;settings={...p.settings};locale?.setLanguage(settings.language);notice='';
      if(!maps.some(m=>m.id===mapId))mapId=maps.find(m=>open(m.id)&&!profile.completedNodes.includes(nodeFor(m.id)?.id??''))?.id??maps[0]?.id??'';
      host.hidden=false;render();},
    hide(){if(!disposed){host.hidden=true;launching=false;}},
    dispose(){if(!disposed){disposed=true;host.remove();}}
  };
}
