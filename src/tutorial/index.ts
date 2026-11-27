import type { GameEvent, GameState, LocaleCatalog, Profile } from '../contracts';
export const TUTORIAL_SECONDS = 120;
export const TUTORIAL_STEPS = ['place','start','upgrade','defend','finish'] as const;
export type TutorialStep = typeof TUTORIAL_STEPS[number];
export interface TutorialSession { readonly runId:string; readonly step:TutorialStep; readonly elapsed:number; readonly done:boolean; }
export interface TutorialUpdate { session:TutorialSession; profile:Profile; }
export function beginTutorial(profile:Profile,state:GameState):TutorialSession|null {
 if(profile.tutorialSeen || state.options.mapId!=='lantern-garden' || state.options.modeId!=='standard' || state.options.players.length>1 || state.wave>1 || state.phase!=='build') return null;
 return {runId:state.options.runId,step:'place',elapsed:0,done:false};
}
function complete(session:TutorialSession,profile:Profile):TutorialUpdate {
 return {session:{...session,step:'finish',done:true},profile:profile.tutorialSeen?profile:{...profile,tutorialSeen:true}};
}
export function dismissTutorial(session:TutorialSession,profile:Profile):TutorialUpdate {return complete(session,profile);}
/** Time is app-supplied real time, not simulation time. No commands or storage. */
export function updateTutorial(session:TutorialSession,profile:Profile,state:GameState,events:readonly GameEvent[],realSeconds:number,action?:'next'|'skip'):TutorialUpdate {
 if(session.done || profile.tutorialSeen) return {session:{...session,done:true},profile};
 if(session.runId!==state.options.runId) return {session:{...session,done:true},profile};
 const elapsed=Math.min(TUTORIAL_SECONDS,session.elapsed+(Number.isFinite(realSeconds)?Math.max(0,realSeconds):0));
 const current={...session,elapsed};
 if(action==='skip'||elapsed>=TUTORIAL_SECONDS||state.phase==='victory'||state.phase==='defeat') return complete(current,profile);
 const observed=(kind:GameEvent['kind'])=>events.some(e=>e.kind===kind);
 let step=session.step;
 if(step==='place' && (state.towers.length>0||observed('place')||action==='next')) step='start';
 else if(step==='start' && (state.phase==='wave'||state.wave>1||observed('waveStart')||action==='next')) step='upgrade';
 else if(step==='upgrade' && (state.towers.some(t=>t.tiers.some(n=>n>0))||observed('upgrade')||state.wave>=2||action==='next')) step='defend';
 else if(step==='defend' && (state.wave>=3||action==='next')) step='finish';
 else if(step==='finish' && action==='next') return complete(current,profile);
 return {session:{...current,step},profile};
}
export function tutorialText(locale:LocaleCatalog,session:TutorialSession):string {return locale.text(`tutorial.${session.step}`);}
export const GUIDE_TOPICS=['layers','paths','economy','sell','difficulty','strict','coop','controls'] as const;
export function fieldGuide(locale:LocaleCatalog):{id:typeof GUIDE_TOPICS[number];title:string;body:string}[]{
 return GUIDE_TOPICS.map(id=>({id,title:locale.text(`guide.${id}.title`),body:locale.text(`guide.${id}.body`)}));
}
/** Non-modal inline panel; the app owns the state, clock, and persistence. */
export function createTutorialPanel(root:HTMLElement,locale:LocaleCatalog,onAction:(action:'next'|'skip')=>void){
 const doc=root.ownerDocument, panel=doc.createElement('section'), title=doc.createElement('h2'), hint=doc.createElement('p'), next=doc.createElement('button'), skip=doc.createElement('button');
 panel.setAttribute('aria-label',locale.text('tutorial.title')); panel.hidden=true;
 hint.setAttribute('role','status'); hint.setAttribute('aria-live','polite'); hint.setAttribute('aria-atomic','true');
 next.type=skip.type='button'; const nextAction=()=>onAction('next'),skipAction=()=>onAction('skip');
 next.addEventListener('click',nextAction);skip.addEventListener('click',skipAction); panel.append(title,hint,next,skip);root.append(panel);
 const setText=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};
 return { update(session:TutorialSession|null){panel.hidden=!session||session.done;if(panel.hidden||!session)return;panel.setAttribute('aria-label',locale.text('tutorial.title'));setText(title,locale.text('tutorial.title'));setText(hint,tutorialText(locale,session));setText(next,locale.text(session.step==='finish'?'tutorial.done':'common.next'));setText(skip,locale.text('tutorial.skip'));}, dispose(){next.removeEventListener('click',nextAction);skip.removeEventListener('click',skipAction);panel.remove();} };
}
