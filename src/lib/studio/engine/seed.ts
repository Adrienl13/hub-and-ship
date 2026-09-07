// Aléa DÉTERMINISTE (lot 2) : un générateur seedé par le sessionId et la
// position dans l'historique. Même session + même historique = même tirage,
// donc même carte suivante. Aucun Math.random dans le moteur.

/** FNV-1a 32 bits d'une chaîne : seed stable et rapide. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 : PRNG 32 bits, suffisant pour ordonner et explorer. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mélange de Fisher-Yates seedé, sans muter l'entrée. */
export function seededShuffle<T>(items: ReadonlyArray<T>, random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = result[index]!
    result[index] = result[swap]!
    result[swap] = current
  }
  return result
}
