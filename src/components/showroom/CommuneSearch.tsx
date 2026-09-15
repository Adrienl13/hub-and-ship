import { useEffect, useState } from 'react'
import { findCommunes, type Commune } from '@/lib/showroom'
export function CommuneSearch({
  onChoose,
  label = 'Votre ville ou code postal',
}: {
  onChoose: (city: Commune) => void
  label?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Commune[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  async function search() {
    if (busy) return
    if (query.trim().length < 2) {
      setMessage('Saisissez une ville ou un code postal.')
      return
    }
    setBusy(true)
    setMessage('')
    setResults([])
    try {
      const rows = await findCommunes(query)
      setResults(rows)
      if (!rows.length)
        setMessage(
          'Aucune commune trouvée. Essayez un autre nom ou code postal.',
        )
    } catch {
      setMessage(
        'Recherche indisponible. Vous pouvez continuer à explorer la carte.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="showroom-search">
      <label>
        {label}
        <input
          disabled={!ready}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void search()
            }
          }}
          placeholder="Ex. Lyon ou 69002"
          maxLength={100}
        />
      </label>
      <button type="button" onClick={() => void search()} disabled={busy || !ready}>
        {busy ? 'Recherche…' : 'Rechercher'}
      </button>
      {message && <p role="status">{message}</p>}
      {results.length > 0 && (
        <ul aria-label="Communes trouvées">
          {results.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => {
                  onChoose(c)
                  setQuery(c.nom)
                  setResults([])
                }}
              >
                {c.nom} · {c.codesPostaux.join(', ')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
