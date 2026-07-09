import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run dev:e2e',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      INSEE_CLIENT_ID: '',
      INSEE_CLIENT_SECRET: '',
      STRIPE_SECRET_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_SUPABASE_URL: '',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
})
