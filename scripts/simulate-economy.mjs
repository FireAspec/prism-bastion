import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fixtureConfig,fixtureService,report,csv,battleProbe,modelCredit} from '../src/economy-analysis/index.mjs';
const args=process.argv.slice(2);if(args.some(a=>a!=='--fixture'))throw Error('Usage: node --import tsx scripts/simulate-economy.mjs [--fixture]');
const fixture=args.includes('--fixture');let config,factory,battle;
if(fixture){config=fixtureConfig();factory=fixtureService;battle=battleProbe(modelCredit,n=>Math.floor(n*.7));}else{const [{loadContent},{createProgression},{credit},{sellRefund}]=await Promise.all([import('../src/content/index.ts'),import('../src/progression/index.ts'),import('../src/contracts/runtime.ts'),import('../src/contracts/rules.ts')]);config=loadContent();factory=createProgression;battle=battleProbe(credit,sellRefund);}
const data=report(config,factory,fixture?'specification-fixture':'production-progression');const out=resolve('validation/economy',fixture?'fixture':'live');await mkdir(out,{recursive:true});
for(const [name,value] of Object.entries({'routes.csv':csv(data.routes),'checkpoints.csv':csv(data.checkpoints),'recommended-values.json':JSON.stringify(data.recommended,null,2)+'\n','summary.json':JSON.stringify({source:data.source,testCount:data.testCount,campaigns:data.campaigns,battle},null,2)+'\n'}))await writeFile(resolve(out,name),value);
console.log(JSON.stringify({source:data.source,checks:data.testCount,routes:data.routes.filter(x=>x.scale===1),out},null,2));
