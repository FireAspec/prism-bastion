import {readFileSync, existsSync} from 'node:fs';
import {test} from '@playwright/test';

export function unavailable(reason:string):void {
  test.info().annotations.push({type:'unavailable',description:reason});
  if(process.env.PB_E2E_REQUIRE_ALL==='1') throw new Error('Unavailable: '+reason);
  test.skip(true,'Unavailable: '+reason);
}
export function requireModules(paths:readonly string[]):void {
  for(const path of paths) {
    if(!existsSync(path)) { unavailable(path+' missing'); return; }
    const source=readFileSync(path,'utf8');
    if(/throw new Error\(['"][^'"]* pending['"]\)/.test(source) && source.split('\n').length<12) {
      unavailable(path+' is a foundation stub'); return;
    }
    if(path==='src/app/main.ts' && source.includes('Игровые модули находятся в разработке')) {
      unavailable('App is a foundation screen'); return;
    }
  }
}
export const appModules=['src/app/main.ts','src/content/index.ts','src/engine/index.ts','src/combat/index.ts','src/ui/menus.ts','src/ui/hud.ts','src/persistence/index.ts'];
export const networkModules=['src/content/index.ts','src/engine/index.ts','src/combat/index.ts','src/network/host/index.ts','src/network/protocol/index.ts'];
