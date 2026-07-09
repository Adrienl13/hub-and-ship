#!/usr/bin/env node
/* global console, process */

import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadLocalEnv() {
  if (!existsSync('.env.local')) return

  const content = readFileSync('.env.local', 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator <= 0) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, '')
    }
  }
}

function requiredEnv(name, fallbackName) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '')
  if (value?.trim()) return value.trim()

  const suffix = fallbackName ? ` ou ${fallbackName}` : ''
  throw new Error(`Variable manquante: ${name}${suffix}`)
}

async function findUserByEmail(admin, email) {
  const wanted = email.toLowerCase()
  let page = 1

  while (page < 50) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    })

    if (error) throw error

    const user = data.users.find((candidate) => {
      return candidate.email?.toLowerCase() === wanted
    })

    if (user) return user
    if (data.users.length < 100) return null

    page += 1
  }

  return null
}

async function main() {
  loadLocalEnv()

  const supabaseUrl = requiredEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const email = requiredEnv('SUPABASE_ADMIN_EMAIL').toLowerCase()
  const password = requiredEnv('SUPABASE_ADMIN_PASSWORD')

  if (password.length < 12) {
    throw new Error('SUPABASE_ADMIN_PASSWORD doit faire au moins 12 caractères.')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const existingUser = await findUserByEmail(admin, email)
  const authResult = existingUser
    ? await admin.auth.admin.updateUserById(existingUser.id, {
        email_confirm: true,
        password,
        user_metadata: { source: 'container_club_admin_bootstrap' },
      })
    : await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: { source: 'container_club_admin_bootstrap' },
      })

  if (authResult.error) throw authResult.error

  const user = authResult.data.user
  const { error: profileError } = await admin.from('users_profile').upsert(
    {
      id: user.id,
      email,
      role: 'super_admin',
      preferred_locale: 'fr-FR',
    },
    { onConflict: 'id' },
  )

  if (profileError) throw profileError

  console.log(`Compte admin prêt: ${email}`)
  console.log('Vous pouvez maintenant vous connecter sur /auth/login.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
