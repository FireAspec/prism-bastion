import {UIAnimator} from './index';
import type {Settings,RewardReceipt} from '../contracts';
const el=(id:string)=>document.getElementById(id)!;
const settings:Settings={reducedMotion:false,quality:'high',colorblind:false,master:1,music:1,sfx:1,language:'ru',fullscreen:false};
const ui=new UIAnimator(el('root'),settings);
const feedback={accepted:'Покупка подтверждена',rejected:'Недостаточно ресурсов',pending:'Ожидание сервера'};
let cash=900,seals=80,xp=0,level=1,request=0,claimed=false,known=false;
const sync=()=>{ui.counter(el('cash'),cash);ui.counter(el('seals'),seals);ui.counter(el('xp'),xp);ui.counter(el('level'),level);};
sync();
const status=(s:string)=>{el('status').textContent=s;};
const click=(id:string,fn:()=>void)=>el(id).addEventListener('click',fn);
click('card',()=>{void ui.play(el('card'),'select');});
click('buy',()=>{const v=ui.submit('build',el('buy'),()=>{if(cash<250)return{ok:false};cash-=250;return{ok:true,amount:250};},feedback);sync();status(v.state==='accepted'?feedback.accepted:v.state==='pending'?feedback.pending:v.state==='idle'?'Повторный клик пропущен':feedback.rejected);});
click('slow',()=>{const v=ui.submit('build',el('slow'),()=>{const id=String(++request);window.setTimeout(()=>{const ok=cash>=250;if(ok)cash-=250;sync();ui.confirm('build',id,{ok,requestId:id});status(ok?feedback.accepted:feedback.rejected);},900);return{ok:false,pending:true,requestId:id};},feedback);if(v.state==='pending')status(feedback.pending);});
click('deny',()=>{ui.submit('deny',el('deny'),()=>({ok:false,reason:'credits'}),feedback);status(feedback.rejected);});
click('burst',()=>{for(let i=0;i<500;i++){cash++;ui.counter(el('cash'),cash);}status('500 начислений объединены');});
click('branchToggle',()=>{const b=el('branch');if(b.hidden){b.hidden=false;void ui.play(b,'unlock');}else{void ui.play(b,'close').then(()=>{b.hidden=true;});}});
click('knowledge',()=>{const v=ui.submit('knowledge',el('knowledge'),()=>{if(known||seals<30)return{ok:false};known=true;seals-=30;return{ok:true};},feedback,'unlock');sync();status(v.state==='accepted'?'Доктрина открыта':'Доктрина недоступна');});
click('respec',()=>{ui.submit('respec',el('respec'),()=>{if(!known)return{ok:false};known=false;return{ok:true};},feedback,'respec');});
const receipt:RewardReceipt={xp:250,seals:80,points:3,levelBefore:1,levelAfter:2,firstClear:true,duplicate:false};
function claim(){if(!claimed){claimed=true;xp+=receipt.xp;seals+=receipt.seals;level=receipt.levelAfter;sync();}const accepted=ui.reward('preview-run',receipt,{reward:el('reward'),level:el('level'),medal:el('medal')},'Получена награда',true);status(accepted?'Награда получена':'Повторная квитанция пропущена');}
click('claim',claim);click('duplicate',()=>{if(claimed)claim();else status('Сначала получите награду');});
function show(id:'shop'|'lobby'){ui.changeScreen();el('shop').hidden=id!=='shop';el('lobby').hidden=id!=='lobby';void ui.play(el(id),'open');sync();}
click('shopTab',()=>show('shop'));click('lobbyTab',()=>show('lobby'));click('back',()=>{show('shop');el('shopTab').focus();});
el('reduced').addEventListener('change',()=>{settings.reducedMotion=(el('reduced') as HTMLInputElement).checked;ui.setSettings(settings);});
