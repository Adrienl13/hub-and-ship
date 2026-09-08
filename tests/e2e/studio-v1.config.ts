import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: ['studio-v1.pw.ts', 'studio-preview.pw.ts'],
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://localhost:5182' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'bunx vite --host 127.0.0.1 --port 5182 --strictPort',
    url: 'http://localhost:5182',
    reuseExistingServer: false,
    env: {
      VITE_STUDIO_ENABLED: 'false',
      VITE_SUPABASE_URL: 'https://fake-supabase.test',
      VITE_SUPABASE_ANON_KEY: 'fake',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      STUDIO_PREVIEW_KEY: 'studio-preview-navigation-test-only',
    },
  },
})
