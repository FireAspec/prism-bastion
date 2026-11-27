#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {prepare,backend,models} from '../src/asset-quality/pipeline.mjs';
import {gallery} from '../src/asset-quality/gallery.mjs';
import {animationGallery} from '../src/asset-quality/animation-gallery.mjs';
try{
 const {values:v}=parseArgs({options:{source:{type:'string',default:'public/art'},stage:{type:'string'},metadata:{type:'string'},backend:{type:'string'},models:{type:'string'},select:{type:'string'},inventory:{type:'boolean'},help:{type:'boolean'}}});
 if(v.help){console.log('node scripts/prepare-assets-4k.mjs --stage NEW_DIRECTORY [--source public/art] [--metadata metadata.json] [--inventory | --backend EXE --models MODEL_DIRECTORY --select all|MODEL,MODEL]\nEnvironment: UPSCAYL_BIN, UPSCAYL_MODELS. Stage parent must exist; stage must not exist.');process.exit(0);}
 if(!v.stage)throw Error('--stage is required');
 const metadata=v.metadata?JSON.parse(await fs.readFile(v.metadata,'utf8')):{};
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))throw Error('Metadata must be keyed by relative resource path');
 const exe=v.backend??process.env.UPSCAYL_BIN,folder=v.models??process.env.UPSCAYL_MODELS;
 const selected=v.inventory?[]:v.select==='all'?models:(v.select??'digital-art-4x,high-fidelity-4x,remacri-4x').split(',');
 if(!v.inventory&&(!exe||!folder))throw Error('Specify backend/models or use --inventory');
 const run=v.inventory?null:await backend(exe,folder,selected);
 const manifest=await prepare({root:v.source,stage:v.stage,metadata,chosen:selected,run});
 await fs.writeFile(path.join(v.stage,'review.html'),gallery(manifest),{flag:'wx'});
 await fs.writeFile(path.join(v.stage,'animation-review.html'),animationGallery(manifest),{flag:'wx'});
 console.log(JSON.stringify({counts:manifest.counts,missingExpected:manifest.missingExpected.length,releaseAccepted:false},null,2));
 if(manifest.records.some(r=>['failed','candidate-failure'].includes(r.status)))process.exitCode=2;
}catch(e){console.error(e.message);process.exitCode=1;}
