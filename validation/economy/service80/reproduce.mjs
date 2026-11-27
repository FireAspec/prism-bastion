// Run after compiling the exact module-80 source and frozen contracts into a separate directory.
// node validation/economy/service80/reproduce.mjs /absolute/path/to/build
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {fixtureConfig,fixtureService,report,battleProbe,csv} from '../../../src/economy-analysis/index.mjs';
if(!process.argv[2])throw Error('Pass compiled module-80 build directory');
const root=resolve(process.argv[2]);
const [{createProgression},{credit},{sellRefund}]=await Promise.all(['progression/index.js','contracts/runtime.js','contracts/rules.js'].map(p=>import(pathToFileURL(join(root,p)))));
const config=fixtureConfig(),real=report(config,createProgression,'module-80-service-synthetic-catalog'),model=report(config,fixtureService,'specification-fixture');
assert.deepEqual(real.routes,model.routes);assert.deepEqual(real.checkpoints,model.checkpoints);assert.deepEqual(real.recommended.candidates,model.recommended.candidates);assert.deepEqual(createProgression(config).validateCatalog(config.knowledge),[]);
const battle=battleProbe(credit,sellRefund),out=resolve('validation/economy/service80');await mkdir(out,{recursive:true});
for(const [name,value] of Object.entries({'routes.csv':csv(real.routes),'checkpoints.csv':csv(real.checkpoints),'recommended-values.json':JSON.stringify(real.recommended,null,2)+'\n','summary.json':JSON.stringify({source:real.source,testCount:real.testCount,campaigns:real.campaigns,battle,comparison:'All route and checkpoint rows equal to fixture; candidate curves equal; catalog validator passed.'},null,2)+'\n'}))await writeFile(join(out,name),value);
console.log('Module 80 parity and frozen ledger checks passed.');
