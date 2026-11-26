import { test } from 'vitest';
import { cases } from './session-cases';
for (const [name, run] of Object.entries(cases)) test(name, run);
