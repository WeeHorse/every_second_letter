// playwright.config.js (ESM)
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: ['e2e/features/**/*.feature'],
  steps: ['e2e/steps/**/*.js'],      // i ESM-konfig heter det ofta "steps"
  outputDir: 'e2e/.generated',
});

export default defineConfig({
  testDir,
  use: {
    baseURL: 'http://localhost:5010',
    trace: 'on-first-retry',
  },
  reporter: [['html', { open: 'never' }]],
});