import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Clear Supabase env vars by default so the "until env keys are present"
// hook tests stay deterministic regardless of what the local .env carries.
// Individual tests that need a configured client can still call vi.stubEnv.
vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
