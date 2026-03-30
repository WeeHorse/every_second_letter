import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const uiTestDir = defineBddConfig({
  features: 'e2e/ui/features/**/*.feature',
  steps: ['e2e/ui/steps/**/*.js', 'e2e/ui/pages/**/*.js'],
  outputDir: '.features-gen/ui'
});

export default defineConfig({
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'ui',
      testDir: uiTestDir,
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ]
});
