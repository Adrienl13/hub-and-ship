import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: '.',
  testMatch: 'studio.spec.ts',
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://localhost:5183' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'bunx vite --host 127.0.0.1 --port 5183 --strictPort',
    url: 'http://localhost:5183',
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
