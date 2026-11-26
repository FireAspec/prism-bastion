// Node 22+: node --experimental-strip-types tests/audio/render-previews.mjs <output-directory>
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {renderTrack,renderCue,SAMPLE_RATE} from '../../src/audio/synthesis.ts';
const dir=process.argv[2]??'audio-previews';
mkdirSync(dir,{recursive:true});
function wav(name,data){
 const b=Buffer.alloc(44+data.length*2);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
 b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(SAMPLE_RATE,24);b.writeUInt32LE(SAMPLE_RATE*2,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);
 for(let i=0;i<data.length;i++)b.writeInt16LE(Math.round(data[i]*32767),44+i*2);
 writeFileSync(join(dir,name+'.wav'),b);
}
for(const t of ['menu','build','wave','boss','victory','defeat','end'])wav(t,renderTrack(t));
const cues=['needle','heavy','frost','fire','electric','acid','energy','water','mechanical','layer','shield','impact','leak','purchase','upgrade','sell','ability','ready','reject','boss','wave','clear','income'];
const reel=new Float32Array(SAMPLE_RATE*2*cues.length);
for(const [i,c] of cues.entries())reel.set(renderCue(c),i*SAMPLE_RATE*2);
wav('sfx',reel);
