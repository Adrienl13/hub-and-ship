// Comparaison de chaînes en temps constant (pas de node:crypto sur Cloudflare
// Workers) : le temps de réponse ne doit pas révéler combien de caractères
// d'un secret correspondent. Même implémentation que le cron de relances.

export function timingSafeEqualStr(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  let diff = aBytes.length ^ bBytes.length
  const length = Math.max(aBytes.length, bBytes.length)
  for (let index = 0; index < length; index += 1) {
    diff |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0)
  }
  return diff === 0
}
