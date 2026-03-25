// playwright.config.js (ESM)
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: ['e2e/api/features/**/*.feature', 'e2e/ui/features/**/*.feature'],
  steps: ['e2e/api/steps/**/*.js', 'e2e/ui/steps/**/*.js'],
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