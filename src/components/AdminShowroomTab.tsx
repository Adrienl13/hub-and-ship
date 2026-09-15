import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  locationSchema,
  showroomClient,
  type LocationRecord,
} from '@/lib/showroom'
import { CommuneSearch } from '@/components/showroom/CommuneSearch'
import '@/styles/showroom.css'
const LocationMap = lazy(() => import('@/components/showroom/LocationMap'))
function emptyLocation(): LocationRecord {
  return {
    id: crypto.randomUUID(),
    name: '',
    address: '',
    city: '',
    postal_code: '',
    city_lat: 46.6,
    city_lng: 2.4,
    latitude: null,
    longitude: null,
    visibility: 'internal',
    publication_agreed: false,
    consent_note: '',
    description: '',
    visit_info: '',
    internal_note: '',
    product_skus: [],
    photo_paths: [],
  }
}
// Re-encode uploads to strip EXIF (including GPS) before storing any photograph.
async function preparePhoto(file: File): Promise<Blob> {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Choisissez une image JPG, PNG ou WebP de moins de 5 Mo.')
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Impossible de préparer la photo.')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Photo invalide.'))),
        'image/jpeg',
        0.88,
      ),
    )
  } finally {
    image.close()
  }
}
export function AdminShowroomTab() {
  const [rows, setRows] = useState<LocationRecord[]>([])
  const [form, setForm] = useState<LocationRecord>(emptyLocation)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<{ sku: string; name: string }[]>([])
  const [productSearch, setProductSearch] = useState('')
  function change<K extends keyof LocationRecord>(
    key: K,
    value: LocationRecord[K],
  ) {
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === 'address' ? { latitude: null, longitude: null } : {}),
    }))
    setDirty(true)
  }
  useEffect(() => {
    let stop = false
    async function load() {
      try {
        const { data, error } = await showroomClient()
          .db.from('showroom_locations')
          .select('*')
          .order('updated_at', { ascending: false })
        if (error)
          throw new Error(
            'Le registre des lieux n’est pas disponible. Vérifiez que la migration Showroom est appliquée sur cet environnement et que vous êtes administrateur.',
          )
        if (!stop) {
          setRows((data ?? []).map((row) => locationSchema.parse(row)))
          setAvailable(true)
        }
      } catch (e) {
        if (!stop)
          setNotice(e instanceof Error ? e.message : 'Chargement impossible.')
      } finally {
        if (!stop) setLoading(false)
      }
    }
    void load()
    void fetch('/api/public-catalogue')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { products?: { sku: string; name: string }[] } | null) => {
        if (!stop) setProducts(data?.products ?? [])
      })
      .catch(() => {})
    return () => {
      stop = true
    }
  }, [])
  useEffect(() => {
    let stop = false
    setPhotos({})
    if (form.photo_paths.length)
      void showroomClient()
        .storage.from('showroom-photos')
        .createSignedUrls(form.photo_paths, 300)
        .then(({ data }) => {
          if (!stop)
            setPhotos(
              Object.fromEntries(
                (data ?? []).flatMap((p) =>
                  p.path && p.signedUrl ? [[p.path, p.signedUrl]] : [],
                ),
              ),
            )
        })
    return () => {
      stop = true
    }
  }, [form.photo_paths])
  useEffect(() => {
    if (!dirty) return
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', before)
    return () => window.removeEventListener('beforeunload', before)
  }, [dirty])
  function choose(row: LocationRecord) {
    if (busy) return
    if (
      dirty &&
      !window.confirm('Quitter ce lieu sans enregistrer les modifications ?')
    )
      return
    setForm(row)
    setDirty(false)
    setNotice('')
  }
  async function save() {
    const parsed = locationSchema.safeParse(form)
    if (!parsed.success) {
      setNotice(parsed.error.issues[0]?.message ?? 'Vérifiez les champs.')
      return
    }
    setBusy(true)
    setNotice('')
    try {
      const { error } = await showroomClient()
        .db.from('showroom_locations')
        .upsert(parsed.data)
      if (error) throw new Error(error.message)
      setRows((r) => [parsed.data, ...r.filter((p) => p.id !== form.id)])
      setDirty(false)
      setNotice(
        form.visibility === 'internal'
          ? 'Lieu enregistré en interne.'
          : 'Lieu enregistré et publié selon la visibilité choisie.',
      )
    } catch {
      setNotice(
        'Enregistrement impossible. Vos modifications restent dans le formulaire ; vérifiez votre connexion et les droits administrateur.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function upload(file: File) {
    if (form.photo_paths.length >= 20) {
      setNotice('Maximum 20 photos par lieu.')
      return
    }
    setBusy(true)
    setNotice('')
    try {
      const blob = await preparePhoto(file)
      const path = `${form.id}/${crypto.randomUUID()}.jpg`
      const { error } = await showroomClient()
        .storage.from('showroom-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw new Error(error.message)
      change('photo_paths', [...form.photo_paths, path])
      setNotice(
        'Photo ajoutée. Enregistrez le lieu pour confirmer son association.',
      )
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Import impossible.')
    } finally {
      setBusy(false)
    }
  }
  const center = useMemo(
    () => ({ latitude: form.city_lat, longitude: form.city_lng }),
    [form.city_lat, form.city_lng],
  )
  const points = useMemo(
    () =>
      form.latitude !== null && form.longitude !== null
        ? [
            {
              id: form.id,
              name: form.name || 'Position du lieu',
              latitude: form.latitude,
              longitude: form.longitude,
            },
          ]
        : [],
    [form.id, form.name, form.latitude, form.longitude],
  )
  return (
    <section className="showroom-admin">
      <h2 className="text-2xl font-semibold">
        Lieux équipés · Showroom à ciel ouvert
      </h2>
      <p className="my-3">
        Ajoutez vos livraisons, associez les modèles et publiez uniquement les
        établissements participants.
      </p>
      <a href="/lieux" target="_blank" rel="noreferrer" className="underline">
        Voir la carte publique ↗
      </a>
      {notice && (
        <p role="status" className="my-4 rounded border p-3">
          {notice}
        </p>
      )}
      {loading ? (
        <p>Chargement du registre…</p>
      ) : !available ? (
        <p>
          Les champs seront disponibles dès que le registre sera accessible.
        </p>
      ) : (
        <div className="showroom-admin-grid">
          <aside>
            <button
              type="button"
              disabled={busy}
              onClick={() => choose(emptyLocation())}
            >
              ＋ Ajouter un lieu
            </button>
            {rows.length === 0 && <p>Aucun lieu enregistré.</p>}
            {rows.map((row) => (
              <button
                key={row.id}
                disabled={busy}
                onClick={() => choose(row)}
                aria-current={form.id === row.id ? 'true' : undefined}
              >
                <strong>{row.name}</strong>
                <br />
                {row.city} ·{' '}
                {row.visibility === 'internal'
                  ? 'Interne'
                  : row.visibility === 'public'
                    ? 'Adresse publique'
                    : 'Sur demande'}
              </button>
            ))}
          </aside>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <fieldset disabled={busy}>
              <legend>Établissement</legend>
              <label>
                Nom de l’établissement
                <input
                  required
                  maxLength={160}
                  value={form.name}
                  onChange={(e) => change('name', e.target.value)}
                />
              </label>
              <label>
                Adresse exacte (interne tant que l’adresse n’est pas publique)
                <input
                  maxLength={500}
                  value={form.address}
                  onChange={(e) => change('address', e.target.value)}
                />
              </label>
              <CommuneSearch
                label="Localiser la commune"
                onChoose={(c) => {
                  if (busy) return
                  setForm((f) => ({
                    ...f,
                    city: c.nom,
                    postal_code: c.codesPostaux[0] ?? '',
                    city_lat: c.centre.coordinates[1],
                    city_lng: c.centre.coordinates[0],
                    latitude: null,
                    longitude: null,
                  }))
                  setDirty(true)
                }}
              />
              <p>
                {form.city
                  ? `Commune sélectionnée : ${form.city}`
                  : 'Sélectionnez une commune pour positionner ce lieu.'}
              </p>
              <label>
                Code postal
                <input
                  required
                  pattern="[0-9]{5}"
                  value={form.postal_code}
                  onChange={(e) => change('postal_code', e.target.value)}
                />
              </label>
              <p>
                Pour une adresse publique, zoomez puis cliquez sur la position
                exacte de l’établissement. Pour « Sur demande », le public verra
                uniquement le centre de la commune.
              </p>
              <Suspense fallback={<p>Chargement de la carte…</p>}>
                <LocationMap
                  points={points}
                  center={center}
                  onPosition={(latitude, longitude) => {
                    if (busy) return
                    setForm((f) => ({ ...f, latitude, longitude }))
                    setDirty(true)
                  }}
                />
              </Suspense>
              <p>
                {form.latitude !== null
                  ? `Position exacte enregistrée : ${form.latitude.toFixed(5)}, ${form.longitude?.toFixed(5)}`
                  : 'Position exacte non définie.'}
              </p>
              <label>
                Notes internes
                <textarea
                  maxLength={5000}
                  value={form.internal_note}
                  onChange={(e) => change('internal_note', e.target.value)}
                />
              </label>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Publication</legend>
              <label>
                Visibilité
                <select
                  value={form.visibility}
                  onChange={(e) =>
                    change(
                      'visibility',
                      e.target.value as LocationRecord['visibility'],
                    )
                  }
                >
                  <option value="internal">
                    Interne — visible uniquement par vous
                  </option>
                  <option value="public">
                    Adresse publique — avec itinéraire
                  </option>
                  <option value="on_request">
                    Sur demande — commune uniquement
                  </option>
                </select>
              </label>
              <label className="showroom-check">
                <input
                  type="checkbox"
                  checked={form.publication_agreed}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      publication_agreed: e.target.checked,
                      visibility: e.target.checked ? f.visibility : 'internal',
                    }))
                    setDirty(true)
                  }}
                />
                L’établissement accepte la publication du lieu, des photos
                sélectionnées et des modalités de visite.
              </label>
              <label>
                Référence de l’accord (interne : date, email ou document)
                <textarea
                  maxLength={2000}
                  value={form.consent_note}
                  onChange={(e) => change('consent_note', e.target.value)}
                />
              </label>
              <label>
                Description publique
                <textarea
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) => change('description', e.target.value)}
                />
              </label>
              <label>
                Modalités de visite publiques
                <textarea
                  placeholder="Ex. Terrasse accessible aux clients du restaurant pendant le service."
                  maxLength={1000}
                  value={form.visit_info}
                  onChange={(e) => change('visit_info', e.target.value)}
                />
              </label>
              {form.visibility === 'on_request' && (
                <p>
                  Pour préserver la confidentialité, évitez le nom ou l’adresse
                  du lieu dans les textes et les photos publics.
                </p>
              )}
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Modèles réellement installés</legend>
              <input
                aria-label="Rechercher un modèle catalogue"
                placeholder="Nom ou référence catalogue"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                {products
                  .filter((p) =>
                    `${p.name} ${p.sku}`
                      .toLowerCase()
                      .includes(productSearch.toLowerCase()),
                  )
                  .map((p) => (
                    <label className="showroom-check" key={p.sku}>
                      <input
                        type="checkbox"
                        checked={form.product_skus.includes(p.sku)}
                        onChange={(e) =>
                          change(
                            'product_skus',
                            e.target.checked
                              ? [...form.product_skus, p.sku]
                              : form.product_skus.filter((s) => s !== p.sku),
                          )
                        }
                      />
                      {p.name} · {p.sku}
                    </label>
                  ))}
              </div>
              {products.length === 0 && (
                <p>
                  Catalogue indisponible ; vous pourrez associer les produits
                  ultérieurement.
                </p>
              )}
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Photos prises sur place</legend>
              <p>
                Vous pouvez enregistrer le lieu maintenant et ajouter les photos
                plus tard. JPG, PNG ou WebP, 5 Mo maximum par photo.
              </p>
              <input
                type="file"
                aria-label="Ajouter une photo du lieu"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void upload(file)
                  e.target.value = ''
                }}
              />
              <div className="showroom-admin-photos">
                {form.photo_paths.map((path) => (
                  <div key={path}>
                    {photos[path] && (
                      <img src={photos[path]} alt="Photo du lieu" />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        change(
                          'photo_paths',
                          form.photo_paths.filter((p) => p !== path),
                        )
                      }
                    >
                      Retirer la photo
                    </button>
                  </div>
                ))}
              </div>
            </fieldset>
            <button className="showroom-primary" type="submit" disabled={busy}>
              {busy
                ? 'En cours…'
                : dirty
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer le lieu'}
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
