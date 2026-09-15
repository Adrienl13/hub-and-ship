import { useEffect, useRef, useState } from 'react'
import type * as Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapPoint = {
  id: string
  name: string
  latitude: number
  longitude: number
  approximate?: boolean
}
export default function LocationMap({
  points,
  selected,
  onSelect,
  center,
  onPosition,
}: {
  points: MapPoint[]
  selected?: string | null
  onSelect?: (id: string) => void
  center?: { latitude: number; longitude: number } | null
  onPosition?: (latitude: number, longitude: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<Leaflet.Map | null>(null)
  const layer = useRef<Leaflet.LayerGroup | null>(null)
  const lib = useRef<typeof Leaflet | null>(null)
  const callbacks = useRef({ onSelect, onPosition })
  callbacks.current = { onSelect, onPosition }
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | undefined
    void import('leaflet')
      .then((L) => {
        if (disposed || !container.current) return
        lib.current = L
        const m = L.map(container.current, { scrollWheelZoom: false }).setView(
          [46.6, 2.4],
          5,
        )
        map.current = m
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on('tileerror', () => setError(true))
          .addTo(m)
        layer.current = L.layerGroup().addTo(m)
        m.on('click', (e: Leaflet.LeafletMouseEvent) =>
          callbacks.current.onPosition?.(e.latlng.lat, e.latlng.lng),
        )
        observer = new ResizeObserver(() => m.invalidateSize())
        observer.observe(container.current)
        setReady(true)
      })
      .catch(() => setError(true))
    return () => {
      disposed = true
      observer?.disconnect()
      map.current?.remove()
      map.current = null
      layer.current = null
    }
  }, [])
  useEffect(() => {
    const L = lib.current,
      m = map.current,
      group = layer.current
    if (!ready || !L || !m || !group) return
    group.clearLayers()
    points.forEach((point) => {
      const active = point.id === selected
      const marker = L.marker([point.latitude, point.longitude], {
        title: point.name,
        alt: point.name,
        keyboard: true,
        icon: L.divIcon({
          className: 'showroom-pin',
          html: `<span class="${active ? 'active' : ''} ${point.approximate ? 'approximate' : ''}"></span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(group)
      const label = document.createElement('span')
      label.textContent = point.name
      marker
        .bindTooltip(label)
        .on('click', () => callbacks.current.onSelect?.(point.id))
    })
  }, [ready, points, selected])
  useEffect(() => {
    if (!ready || !map.current) return
    const point = points.find((p) => p.id === selected)
    const target = point ?? center
    if (target)
      map.current.setView(
        [target.latitude, target.longitude],
        point?.approximate ? 10 : point ? 14 : 10,
        { animate: false },
      )
    else map.current.setView([46.6, 2.4], 5, { animate: false })
    // Updating the points alone should not reset a visitor's manual map position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected, center])
  return (
    <div className="showroom-map-wrap">
      <div
        ref={container}
        className="showroom-map"
        aria-label="Carte des lieux équipés"
      />
      {error && (
        <p className="showroom-map-notice" role="status">
          Le fond de carte est indisponible. La liste des lieux reste
          accessible.
        </p>
      )}
    </div>
  )
}
