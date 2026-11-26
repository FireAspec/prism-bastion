import type {HostOptions,RunOptions} from '../src/contracts';
import {loadContent,validateContent} from '../src/content';
import {createGame} from '../src/engine';
import {createCombat} from '../src/combat';
import {createProgression} from '../src/progression';
import {startHost} from '../src/network/host';
export async function launchHost(options:HostOptions,run:RunOptions){
  const config=loadContent();
  const errors=validateContent(config);
  if(errors.length)throw new Error('Content validation failed');
  const progression=createProgression(config);
  return startHost(options,run,{
    config,
    createEngine: selected=>createGame(progression.applyKnowledge(config,selected.knowledge,selected.modeId),selected,createCombat())
  });
}
