export type Scene = 'menu'|'build'|'wave'|'boss'|'end';
export type Track = Scene|'victory'|'defeat';
export const SAMPLE_RATE = 22050;
export type Cue = 'needle'|'heavy'|'frost'|'fire'|'electric'|'acid'|'energy'|'water'|'mechanical'|'layer'|'shield'|'impact'|'leak'|'purchase'|'upgrade'|'sell'|'ability'|'ready'|'reject'|'boss'|'wave'|'clear'|'income';
type Instrument = 'pluck'|'bell'|'strings'|'bass'|'drum'|'air';
const tau = 2*Math.PI;
const hz = (midi:number)=>440*2**((midi-69)/12);
function note(out:Float32Array,start:number,length:number,pitch:number,volume:number,kind:Instrument,slide=0):void {
 const first=Math.round(start*SAMPLE_RATE), n=Math.min(Math.round(length*SAMPLE_RATE),out.length-first);
 let phase=0, noise=0, seed=(first+pitch*997+1)|0;
 const f=hz(pitch), increment=tau*f/SAMPLE_RATE, attack=kind==='strings'?0.09:kind==='air'?0.025:0.008;
 const release=kind==='strings'?0.18:0.06;
 for(let i=0;i<n;i++){
  const t=i/SAMPLE_RATE, p=i/Math.max(1,n-1);
  const env=Math.min(1,t/attack,(n-i-1)/SAMPLE_RATE/release)*Math.exp(-p*(kind==='strings'?0.25:kind==='bass'?1.8:4));
  phase+=slide===0?increment:increment*2**(slide*p/12);
  if(kind==='air'||kind==='drum'){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;noise=0.82*noise+0.18*((seed>>>0)/2147483648-1);}
  const s=Math.sin(phase); let value:number;
  switch(kind){
   case 'pluck':value=0.7*s+0.21*Math.sin(2*phase)*Math.exp(-4*p)+0.09*Math.sin(3*phase)*Math.exp(-7*p);break;
   case 'bell':value=0.62*s+0.23*Math.sin(2.01*phase)+0.10*Math.sin(3.98*phase)*Math.exp(-5*p);break;
   case 'strings':value=0.55*s+0.22*Math.sin(phase*1.003)+0.12*Math.sin(2*phase)+0.07*Math.sin(3*phase);break;
   case 'bass':value=0.85*s+0.13*Math.sin(2*phase);break;
   case 'drum':value=0.76*Math.sin(phase)+0.24*noise;break;
   case 'air':value=0.45*s+0.55*noise;break;
  }
  if(first+i>=0)out[first+i]+=value*env*volume;
 }
}
function finish(out:Float32Array,echo:number):Float32Array {
 const lag=Math.round(0.145*SAMPLE_RATE), second=Math.round(0.273*SAMPLE_RATE);
 for(let i=out.length-1;i>=second;i--)out[i]+=echo*(out[i-lag]+0.5*out[i-second]);
 const edge=Math.min(Math.round(0.025*SAMPLE_RATE),Math.floor(out.length/2));
 for(let i=0;i<edge;i++){out[i]*=i/edge;out[out.length-i-1]*=i/edge;}
 let peak=0;for(const x of out)peak=Math.max(peak,Math.abs(x));
 if(peak>0.82)for(let i=0;i<out.length;i++)out[i]*=0.82/peak;
 return out;
}
// The beacon motif is transformed across the four arrangements. Each loop has 16 bars.
const bright = [[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,60],[50,57,62,65],[53,60,65,69],[48,55,60,64],[45,52,57,61]];
const dark = [[50,57,62,65],[51,58,63,67],[46,53,58,62],[45,52,57,61],[50,57,62,65],[48,55,60,63],[46,53,58,62],[45,52,57,61]];
const motif = [[62,65,69,67],[65,62,60,58],[60,64,67,69],[64,62,61,57],[62,65,69,74],[72,69,65,67],[67,64,60,62],[61,64,57,62]];
export function renderTrack(track:Track):Float32Array {
 if(track==='victory'||track==='defeat'||track==='end'){
  const out=new Float32Array(SAMPLE_RATE*5), win=track==='victory';
  const melody=win?[62,65,69,74,77,81]:track==='defeat'?[69,65,62,58,57,50]:[62,65,69,65,62,57];
  melody.forEach((p,i)=>note(out,i*0.42,0.8,p,0.16,'bell'));
  const chord=win?[50,57,62,66,69]:[50,57,60,65];
  chord.forEach(p=>note(out,1.65,3.1,p,0.065,'strings'));
  return finish(out,0.18);
 }
 const bpm=track==='menu'?76:track==='build'?84:track==='wave'?112:104;
 const beat=60/bpm, bar=beat*4, out=new Float32Array(Math.round(16*bar*SAMPLE_RATE));
 const battle=track==='wave'||track==='boss', boss=track==='boss';
 for(let b=0;b<16;b++){
  const chord=(boss?dark:bright)[b%8], start=b*bar;
  chord.slice(1).forEach(p=>note(out,start,bar*0.98,p,0.047,'strings'));
  const pulses=battle?4:2;
  for(let i=0;i<pulses;i++)note(out,start+i*bar/pulses,bar/pulses*0.88,chord[i%2===0?0:1]-12,0.105,'bass');
  for(let i=0;i<8;i++){
   if(!battle&&i%2===1&&b<8)continue;
   const p=chord[[1,2,3,2,1,3,2,3][i]]+12;
   note(out,start+i*beat/2,beat*0.64,p,0.046+(i%4===0?0.017:0),'pluck');
  }
  const phrase=motif[b%8];
  const offsets=b<8?[0,1,2,3]:[0,0.75,2,3.25];
  phrase.forEach((p,i)=>{
   const pitch=boss?(i===2?p-1:p-12):p+(b>=8&&i===2?12:0);
   note(out,start+offsets[i]*beat,Math.min(beat*1.28,bar-offsets[i]*beat-0.015),pitch,track==='menu'?0.09:0.112,'bell');
  });
  if(battle){
   for(const i of [0,2])note(out,start+i*beat,0.18,boss?31:36,0.13,'drum',-12);
   for(const i of [1,3])note(out,start+i*beat,0.13,47,0.045,'air',-4);
   if(b>=8)for(const i of [0.5,1.5,2.5,3.5])note(out,start+i*beat,0.07,76,0.022,'air');
  }
 }
 return finish(out,0.15);
}
type Tone = [number,number,number,number,Instrument,number?];
const cues:Record<Cue,Tone[]>={
 needle:[[0,.09,80,.17,'pluck',-9]], heavy:[[0,.26,43,.36,'drum',-14],[.015,.15,53,.14,'air',-10]],
 frost:[[0,.22,84,.18,'bell',-7],[.05,.17,91,.08,'air',-5]], fire:[[0,.18,62,.2,'air',-13],[.015,.2,43,.1,'drum',-10]],
 electric:[[0,.12,75,.17,'air',7],[.065,.1,84,.12,'pluck',-12]], acid:[[0,.16,56,.22,'pluck',-5],[.08,.12,64,.1,'air',-9]],
 energy:[[0,.19,69,.19,'bell',5]], water:[[0,.23,64,.19,'air',-7],[.06,.18,55,.12,'bass',4]], mechanical:[[0,.14,55,.2,'pluck',-3],[.035,.09,68,.09,'air']],
 layer:[[0,.11,78,.16,'bell',-3]], shield:[[0,.21,69,.2,'bell',-8],[.04,.16,81,.08,'air']], impact:[[0,.12,50,.18,'drum',-9]],
 leak:[[0,.22,66,.24,'bass',-3],[.20,.32,57,.24,'bell',-5]], purchase:[[0,.16,67,.19,'pluck'],[.11,.22,74,.18,'bell']],
 upgrade:[[0,.18,67,.17,'pluck'],[.09,.18,71,.17,'bell'],[.19,.26,79,.18,'bell']], sell:[[0,.17,72,.16,'pluck'],[.11,.22,64,.15,'bell']],
 ability:[[0,.32,55,.20,'strings',7],[.08,.24,74,.23,'bell',5],[.24,.28,86,.15,'bell']], ready:[[0,.18,76,.15,'bell'],[.12,.22,81,.13,'bell']],
 reject:[[0,.16,53,.19,'bass'],[.15,.19,51,.17,'bass']], boss:[[0,.55,38,.32,'bass'],[.28,.45,45,.22,'drum'],[.58,.6,50,.19,'strings']],
 wave:[[0,.25,62,.15,'bell'],[.15,.25,69,.16,'bell'],[.32,.32,74,.17,'bell']], clear:[[0,.22,69,.16,'pluck'],[.16,.32,77,.16,'bell']], income:[[0,.10,84,.11,'bell'],[.07,.13,88,.08,'bell']]
};
export function renderCue(cue:Cue):Float32Array {
 const tones=cues[cue]; const out=new Float32Array(Math.ceil((Math.max(...tones.map(t=>t[0]+t[1]))+0.31)*SAMPLE_RATE));
 for(const t of tones)note(out,...t);return finish(out,0.08);
}
