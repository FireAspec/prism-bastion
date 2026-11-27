import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureConfig,fixtureService,checks,simulate,battleProbe,modelCredit} from '../../src/economy-analysis/index.mjs';
test('profile, reward, respec and coop',()=>assert.equal(checks(fixtureConfig(),fixtureService),22));
test('campaign arithmetic',()=>{const p=simulate(fixtureConfig(),fixtureService,'campaign-no-knowledge').final;assert.equal(p.xp,21860);assert.equal(p.seals,4305);assert.equal(p.points,54);assert.equal(p.level,19);});
test('all 150 nodes attainable',()=>{const p=simulate(fixtureConfig(),fixtureService,'diverse').final;assert.equal(p.nodes,150);assert.equal(p.freePoints,0);});
test('ledger',()=>assert.equal(battleProbe(modelCredit,n=>Math.floor(n*.7)).refund,339));
