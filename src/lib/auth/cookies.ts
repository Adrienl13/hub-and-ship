// Minimal `Cookie:` header parser used by server functions that need to
// read Supabase auth cookies. We deliberately avoid pulling a dependency
// like `cookie` because the parsing we need is trivial (no quoting, no
// encoding round-trip — the Supabase SDK already URL-encodes values).

import type { ServerCookie } from '@/lib/supabase/server'

/**
 * Parses a raw `Cookie:` request header into a list of `{ name, value }`
 * objects. Trims surrounding whitespace and skips malformed entries.
 *
 * Returns an empty array for `null`/`undefined`/empty inputs so callers
 * can hand the result directly to a Supabase server cookie adapter.
 */
export function parseCookieHeader(
  header: string | null | undefined,
): ReadonlyArray<ServerCookie> {
  if (!header) return []
  const out: ServerCookie[] = []
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const name = trimmed.slice(0, eq).trim()
    if (!name) continue
    const value = trimmed.slice(eq + 1).trim()
    out.push({ name, value })
  }
  return out
}
