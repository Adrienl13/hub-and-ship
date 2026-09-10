import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'studio-customization.pw.ts',
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://localhost:5186' },
  projects: [
    {
      name: '1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: '1280',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    { name: 'Pixel5', use: { ...devices['Pixel 5'] } },
    {
      name: 'iPadMini',
      use: { ...devices['iPad Mini'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'bunx vite --host 127.0.0.1 --port 5186 --strictPort',
    url: 'http://localhost:5186',
    reuseExistingServer: false,
    env: {
      VITE_STUDIO_ENABLED: 'true',
      VITE_SUPABASE_URL: 'https://fake-supabase.test',
      VITE_SUPABASE_ANON_KEY: 'fake',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
  },
})
