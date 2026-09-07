import { expect, it, vi } from 'vitest'
import { createStudioFavoritesQueue } from './favorites-sync'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

it.each([[true, false], [true, false, true]])('dernière intention gagnante : %j', async (...intentions: boolean[]) => {
  const enqueue = createStudioFavoritesQueue()
  const gates = intentions.map(() => deferred())
  let remote = false
  const writers = intentions.map((favorite, index) => vi.fn(async () => {
    await gates[index]!.promise
    remote = favorite
  }))
  const jobs = writers.map((write) => enqueue('user', 'product', write))
  await Promise.resolve()
  expect(writers[0]).toHaveBeenCalledTimes(1)
  expect(writers[1]).not.toHaveBeenCalled()
  // Les réponses suivantes sont disponibles avant la première ; leurs
  // écritures ne peuvent pourtant pas démarrer avant sa fin.
  for (const gate of gates.slice(1)) gate.resolve()
  await Promise.resolve()
  expect(writers[1]).not.toHaveBeenCalled()
  gates[0]!.resolve()
  await Promise.all(jobs)
  expect(remote).toBe(intentions[intentions.length - 1])
  expect(writers.every((write) => write.mock.calls.length === 1)).toBe(true)
})

it('isole comptes et produits, et continue après un échec', async () => {
  const enqueue = createStudioFavoritesQueue()
  const gate = deferred()
  const first = enqueue('u', 'p', () => gate.promise)
  const other = vi.fn(async () => undefined)
  await enqueue('v', 'p', other)
  await enqueue('u', 'q', other)
  expect(other).toHaveBeenCalledTimes(2)
  gate.resolve()
  await first
  await enqueue('u', 'p', async () => { throw new Error('offline') })
  await enqueue('u', 'p', other)
  expect(other).toHaveBeenCalledTimes(3)
})
