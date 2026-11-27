import fs from 'node:fs/promises';
import path from 'node:path';
import {encodePNG,decodePNG} from '../../src/asset-quality/png.mjs';
import {prepare} from '../../src/asset-quality/pipeline.mjs';
import {gallery} from '../../src/asset-quality/gallery.mjs';
const root=path.resolve(process.argv[2]??'quality-fixture');await fs.mkdir(root);const art=path.join(root,'art');await fs.mkdir(art);await fs.mkdir(path.join(art,'ui'));
const width=160,height=160,data=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const dx=x-79.5,dy=y-79.5,r=Math.hypot(dx,dy),i=(y*width+x)*4;let rgba=[255,255,255,0];if(r<68){const edge=Math.min(1,68-r);let col=r>60?[117,66,32]:r>52?[221,165,82]:r>47?[62,102,108]:[18,53,65];if(Math.abs(dx)+Math.abs(dy)*.8<43)col=dy<0?[87,221,218]:[28,132,160];if(Math.abs(dx+dy*.32)<1.4&&Math.abs(dy)<27)col=[229,255,239];rgba=[...col,Math.round(edge*255)];}data.set(rgba,i);}
await fs.writeFile(path.join(art,'ui','crystal.png'),encodePNG({width,height,data}));
await fs.writeFile(path.join(art,'ui','vector.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="54" fill="#183b43" stroke="#dba55b" stroke-width="5"/><path d="M64 16 100 64 64 112 28 64Z" fill="#36a8b6" stroke="#9df8ea" stroke-width="3"/><path d="M64 16 64 112 28 64Z" fill="#246c8d"/></svg>');
const metadata={'ui/crystal.png':{kind:'icon',target:{width:480,height:480},pivot:{x:80,y:80}},'ui/vector.svg':{target:{width:480,height:480},pivot:{x:64,y:64}}};await fs.writeFile(path.join(root,'metadata.json'),JSON.stringify(metadata,null,2));
// Deliberately simple nearest-neighbor substitute, never a real backend result.
async function mock(input,output,model,scale){const src=decodePNG(await fs.readFile(input)),width=src.width*scale,height=src.height*scale,data=Buffer.alloc(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const j=(Math.floor(y/scale)*src.width+Math.floor(x/scale))*4;src.data.copy(data,(y*width+x)*4,j,j+4);}await fs.writeFile(output,encodePNG({width,height,data}));}
const stage=path.join(root,'stage');const manifest=await prepare({root:art,stage,metadata,chosen:['digital-art-4x'],run:mock,backendKind:'test-double-nearest-neighbor'});await fs.writeFile(path.join(stage,'review.html'),gallery(manifest));console.log(JSON.stringify({stage,backendKind:manifest.backendKind,counts:manifest.counts}));
