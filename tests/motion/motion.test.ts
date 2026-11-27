import { test } from 'vitest';
import { motionCases } from './cases';
for(const [name,run] of Object.entries(motionCases))test(name,run);
