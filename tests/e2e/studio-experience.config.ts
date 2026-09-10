import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'studio-experience.pw.ts',
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://localhost:5196' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 980 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'DESIGN_REVIEW_PORT=5196 bun run design:review',
    url: 'http://localhost:5196',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
