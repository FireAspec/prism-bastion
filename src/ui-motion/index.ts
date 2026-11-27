import type {CommandResult, RewardReceipt, Settings} from '../contracts';
import type {UIMotion, UITransition} from '../contracts/motion';

const frames: Record<UITransition, [Keyframe[], number]> = {
  purchase: [[{scale:'1',filter:'brightness(1)'},{scale:'1.045',filter:'brightness(1.3)',offset:.35},{scale:'1',filter:'brightness(1)'}],300],
  reject: [[{translate:'0'},{translate:'-5px'},{translate:'5px'},{translate:'-3px'},{translate:'0'}],240],
  unlock: [[{opacity:.45,scale:'.96'},{opacity:1,scale:'1.03',offset:.7},{opacity:1,scale:'1'}],340],
  levelUp: [[{scale:'.92',opacity:.55},{scale:'1.07',opacity:1,offset:.55},{scale:'1',opacity:1}],440],
  reward: [[{translate:'0 8px',opacity:.45},{translate:'0 0',opacity:1}],320],
  open: [[{translate:'0 10px',opacity:.35},{translate:'0 0',opacity:1}],220],
  close: [[{opacity:1},{opacity:0}],150],
  select: [[{scale:'.98'},{scale:'1.025'},{scale:'1'}],180],
  respec: [[{filter:'brightness(.7)'},{filter:'brightness(1)'}],260],
};

type Running = {animation: Animation; finish: () => void};
export interface MotionController extends UIMotion {
  cancel(element?: HTMLElement): void;
  readonly reduced: boolean;
}
export function createUIMotion(settings: Settings): MotionController {
  let reduced = settings.reducedMotion, disposed = false;
  const running = new Map<HTMLElement, Running>();
  const observers = new Map<Document, MutationObserver>();
  function cancel(element?: HTMLElement): void {
    if (!element) { for (const node of [...running.keys()]) cancel(node); return; }
    const current = running.get(element);
    if (current) { current.animation.cancel(); current.finish(); }
  }
  function watch(doc: Document): void {
    if (observers.has(doc)) return;
    const Observer = doc.defaultView?.MutationObserver;
    if (!Observer) return;
    const observer = new Observer(() => {
      for (const node of running.keys()) if (!node.isConnected) cancel(node);
    });
    observer.observe(doc, {childList:true,subtree:true}); observers.set(doc,observer);
  }
  return {
    get reduced() { return reduced; },
    play(element, transition) {
      cancel(element);
      if (disposed || reduced || !element.isConnected || typeof element.animate !== 'function') return Promise.resolve();
      const [keyframes, duration] = frames[transition];
      let animation: Animation;
      try { animation = element.animate(keyframes,{duration,easing:'cubic-bezier(.2,.75,.25,1)',fill:'none'}); }
      catch { return Promise.resolve(); }
      return new Promise<void>(resolve => {
        const finish = () => {
          if (running.get(element)?.animation === animation) running.delete(element);
          if (![...running.keys()].some(node => node.ownerDocument === element.ownerDocument)) {
            observers.get(element.ownerDocument)?.disconnect(); observers.delete(element.ownerDocument);
          }
          resolve();
        };
        running.set(element,{animation,finish}); watch(element.ownerDocument);
        void animation.finished.then(finish,finish);
      });
    },
    cancel,
    setSettings(value) { reduced = value.reducedMotion; if (reduced) cancel(); },
    dispose() { disposed = true; cancel(); for (const observer of observers.values()) observer.disconnect(); observers.clear(); },
  };
}

export type PurchaseState = 'idle' | 'pending' | 'accepted' | 'rejected';
export interface Feedback {accepted: string; rejected: string; pending: string}
export interface PurchaseView {state: PurchaseState; result?: CommandResult}
type Pending = {element: HTMLElement; epoch: number; text: Feedback; requestId?: string; result?: CommandResult; transition: UITransition};
type Counter = {from:number; target:number; shown:number; start:number; end:number; format:(n:number)=>string};

/** One instance per application root. All amounts are authoritative inputs, never deltas. */
export class UIAnimator {
  private readonly motion: MotionController;
  private readonly live: HTMLElement;
  private readonly observer: MutationObserver;
  private readonly pending = new Map<string,Pending>();
  private readonly receipts = new Set<string>();
  private readonly acceptedAt = new Map<string,number>();
  private readonly counters = new Map<HTMLElement,Counter>();
  private epoch = 0;
  private disposed = false;
  private raf = 0;
  private announceTimer: number | undefined;
  private message = '';
  private readonly win: Window;
  private readonly media: MediaQueryList | undefined;
  private settings: Settings;
  private readonly onPreference = () => this.setSettings(this.settings);
  constructor(private readonly root: HTMLElement, settings: Settings) {
    const win = root.ownerDocument.defaultView;
    if (!win || !root.isConnected) throw new Error('UI root must be attached');
    this.win = win; this.settings = {...settings};
    this.media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.motion = createUIMotion({...settings,reducedMotion:settings.reducedMotion || !!this.media?.matches});
    this.media?.addEventListener('change',this.onPreference);
    this.live = root.ownerDocument.createElement('span');
    this.live.setAttribute('role','status'); this.live.setAttribute('aria-live','polite'); this.live.setAttribute('aria-atomic','true');
    this.live.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
    root.append(this.live);
    const Observer = root.ownerDocument.defaultView!.MutationObserver;
    this.observer = new Observer(() => {
      if (!root.isConnected) {this.dispose(); return;}
      for (const element of this.counters.keys()) if (!root.contains(element)) this.counters.delete(element);
    });
    this.observer.observe(root.ownerDocument,{subtree:true,childList:true});
  }
  private active(element: HTMLElement): boolean {return !this.disposed && this.root.isConnected && this.root.contains(element);}
  private announce(text: string): void {
    if (!text || this.disposed) return;
    this.message = text;
    if (this.announceTimer !== undefined) return;
    this.announceTimer = this.win.setTimeout(() => {
      this.announceTimer = undefined; this.live.textContent = this.message; this.message = '';
    },350);
  }
  private mark(element: HTMLElement,state: PurchaseState): void {
    if (!this.active(element)) return;
    element.dataset.motionState = state;
    if (state === 'pending') element.setAttribute('aria-busy','true'); else element.removeAttribute('aria-busy');
  }
  isPending(key: string): boolean { return this.pending.has(key); }
  /** The key identifies a logical purchase, not a replaceable DOM node. */
  submit(key:string, element:HTMLElement, send:()=>CommandResult, text:Feedback, transition:UITransition='purchase'): PurchaseView {
    if (!this.active(element)) return {state:'idle'};
    if (this.pending.has(key)) { this.bind(key,element); return {state:'pending'}; }
    const now=this.win.performance.now();
    for(const [k,at] of this.acceptedAt) if(now-at>=300) this.acceptedAt.delete(k);
    if(this.acceptedAt.has(key)) return {state:'idle'};
    const p:Pending = {element,epoch:this.epoch,text,transition};
    this.pending.set(key,p); this.mark(element,'pending');
    let result:CommandResult;
    try {result = send();} catch {result = {ok:false,reason:'dispatch-failed'};}
    if (result.pending) {
      p.requestId = result.requestId;
      this.announce(text.pending); return {state:'pending',result};
    }
    return this.finish(key,p,result);
  }
  /** Only call after matching result and corresponding authoritative snapshot/event. */
  confirm(key:string, requestId:string, result:CommandResult): PurchaseView {
    const p = this.pending.get(key);
    if (!p || !p.requestId || p.requestId !== requestId || (result.requestId !== undefined && result.requestId !== requestId) || result.pending) return {state:'idle'};
    return this.finish(key,p,result);
  }
  /** Explicit terminal transport failure after the host outcome is reconciled. */
  rejectUnresolved(key:string): PurchaseView {
    const p = this.pending.get(key); return p ? this.finish(key,p,{ok:false,reason:'transport-failed'}) : {state:'idle'};
  }
  private finish(key:string,p:Pending,result:CommandResult): PurchaseView {
    this.pending.delete(key);
    if(result.ok) this.acceptedAt.set(key,this.win.performance.now());
    const state = result.ok ? 'accepted' : 'rejected';
    if (p.epoch === this.epoch && this.active(p.element)) {
      this.mark(p.element,state); void this.motion.play(p.element,result.ok ? p.transition : 'reject');
      this.announce(result.ok ? p.text.accepted : p.text.rejected);
    }
    return {state,result};
  }
  /** Rebind a still-pending logical action after rendering a replacement control. */
  bind(key:string,element:HTMLElement): void {
    const p = this.pending.get(key);
    if (p && this.active(element)) {if(p.element!==element&&this.active(p.element)) this.mark(p.element,'idle');p.element = element;p.epoch = this.epoch;this.mark(element,'pending');}
  }
  play(element:HTMLElement,transition:UITransition):Promise<void> {return this.active(element) ? this.motion.play(element,transition) : Promise.resolve();}
  /** Run ID comes from RunResult; medal flag comes from the updated profile. */
  reward(runId:string,receipt:RewardReceipt, elements:{reward?:HTMLElement;level?:HTMLElement;medal?:HTMLElement},message:string,medalEarned:boolean): boolean {
    if (this.disposed || !runId || receipt.duplicate || this.receipts.has(runId)) return false;
    this.receipts.add(runId);
    if (elements.reward && (receipt.xp>0 || receipt.seals>0 || receipt.points>0)) void this.play(elements.reward,'reward');
    if (elements.level && receipt.levelAfter>receipt.levelBefore) void this.play(elements.level,'levelUp');
    if (elements.medal && medalEarned) void this.play(elements.medal,'unlock');
    this.announce(message); return true;
  }
  counter(element:HTMLElement,target:number,format:(n:number)=>string=String):void {
    if (!this.active(element) || !Number.isSafeInteger(target) || target<0) return;
    const now = this.win.performance.now(), old = this.counters.get(element);
    if (!old || this.motion.reduced) {
      this.counters.set(element,{from:target,target,shown:target,start:now,end:now,format}); element.textContent=format(target); return;
    }
    if (target === old.target) {old.format=format;return;}
    const shown = old.shown;
    // Keep the original burst deadline; continuous income cannot postpone convergence indefinitely.
    const end = old.end > now ? old.end : now+240;
    this.counters.set(element,{from:shown,target,shown,start:now,end,format});
    if (!this.raf) this.raf=this.win.requestAnimationFrame(this.tick);
  }
  private sample(c:Counter,now:number):number {
    const t = c.end<=c.start ? 1 : Math.min(1,Math.max(0,(now-c.start)/(c.end-c.start)));
    return Math.round(c.from+(c.target-c.from)*(1-(1-t)**3));
  }
  private tick = (now:number) => {
    this.raf=0; let more=false;
    for (const [element,c] of this.counters) {
      if (!this.active(element)) {this.counters.delete(element);continue;}
      const n=this.sample(c,now); if (n!==c.shown) {c.shown=n;element.textContent=c.format(n);}
      if (now<c.end) more=true;
    }
    if (more) this.raf=this.win.requestAnimationFrame(this.tick);
  };
  private settleCounters():void {
    if (this.raf) this.win.cancelAnimationFrame(this.raf);this.raf=0;
    for (const [element,c] of this.counters) {if (this.active(element)) element.textContent=c.format(c.target);c.shown=c.from=c.target;c.end=c.start=0;}
  }
  setSettings(settings:Settings):void {
    this.settings={...settings};this.motion.setSettings({...settings,reducedMotion:settings.reducedMotion||!!this.media?.matches});
    if (this.motion.reduced) this.settleCounters();
  }
  /** Call before replacing a screen; focus and actual navigation remain with its owner. */
  changeScreen():void {
    this.epoch++;this.motion.cancel();this.settleCounters();this.counters.clear();
    if (this.announceTimer!==undefined) this.win.clearTimeout(this.announceTimer);this.announceTimer=undefined;this.message='';this.live.textContent='';
    for (const p of this.pending.values()) if (this.active(p.element)) {p.element.removeAttribute('aria-busy');delete p.element.dataset.motionState;}
  }
  dispose():void {
    if (this.disposed) return;this.changeScreen();this.disposed=true;this.pending.clear();this.receipts.clear();this.acceptedAt.clear();this.motion.dispose();this.observer.disconnect();this.media?.removeEventListener('change',this.onPreference);this.live.remove();
  }
}
