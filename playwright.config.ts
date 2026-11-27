import {defineConfig} from '@playwright/test';

const baseURL = process.env.PB_E2E_URL ?? 'http://127.0.0.1:41772';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.pw.ts',
  timeout: 60_000,
  globalTimeout: 15 * 60_000,
  expect: {timeout: 8_000},
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/e2e',
  reporter: [['list'], ['json', {outputFile:'test-results/e2e-report.json'}]],
  use: {baseURL, actionTimeout: 8_000, navigationTimeout: 15_000, trace:'retain-on-failure', screenshot:'only-on-failure', locale:'ru-RU'},
  webServer: process.env.PB_E2E_URL ? undefined : {
    command:'npm run dev -- --port 41772 --strictPort',
    url:baseURL, timeout:30_000, reuseExistingServer:false
  },
  projects: [
    {name:'network', testMatch:'network.pw.ts'},
    {name:'windows-desktop', testMatch:'desktop.pw.ts', timeout:90_000},
    {name:'1366x768', testMatch:['ui.pw.ts','art.pw.ts'], use:{browserName:'chromium',viewport:{width:1366,height:768},deviceScaleFactor:1}},
    {name:'1920x1080', testMatch:['ui.pw.ts','art.pw.ts'], use:{browserName:'chromium',viewport:{width:1920,height:1080},deviceScaleFactor:1}}
  ]
});
