import type {GameConfig} from '../../src/contracts';

// This isolated fixture changes only the number and duration of waves.
// The production engine, protocol, host, wallet and progression remain in use.
export function shortConfig(source:GameConfig):GameConfig{
  return {...source,
    difficulties:source.difficulties.map(d=>d.id==='normal'?{...d,rounds:1}:d),
    waves:[{number:1,groups:[{enemy:'scarlet',count:1,at:0,every:0.1,lane:0,speedMul:100}],reward:84,preview:'QA single enemy'}],
    maps:source.maps.map(m=>m.id==='lantern-garden'?{...m,waveOverrides:{}}:m)
  };
}
