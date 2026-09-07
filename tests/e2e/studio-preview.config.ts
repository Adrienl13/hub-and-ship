import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// Serveur local isolé : flag OFF et clé factice de test en mémoire seulement.
// Aucun fichier de secret ni configuration de production n'est modifié.
export default defineConfig({
  testDir: '.',
  testMatch: 'studio-preview.pw.ts',
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://localhost:5181', ...devices['Desktop Chrome'] },
  webServer: {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: 'bunx vite --host 127.0.0.1 --port 5181 --strictPort',
    url: 'http://localhost:5181',
    reuseExistingServer: false,
    env: {
      VITE_STUDIO_ENABLED: 'false',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      STUDIO_PREVIEW_KEY: 'studio-preview-navigation-test-only',
    },
  },
})
