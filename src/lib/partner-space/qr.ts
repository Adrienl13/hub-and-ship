import qrcode from 'qrcode-generator'

/**
 * Partner QR + link helpers (LOT 6). The QR encodes the partner's tagged link
 * (LOT 2 convention) so every scan is first-touch attributed to their code and
 * later drives the 8% commission (LOT 5).
 */

const DEFAULT_DOMAIN = 'https://prosimport.com'

function appOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL
  if (!configured) return DEFAULT_DOMAIN
  try {
    return new URL(configured).origin
  } catch {
    return DEFAULT_DOMAIN
  }
}

/** Partner link: `<origin>/?ref=<CODE>&utm_source=partner&utm_medium=qr&utm_campaign=corner_depot`. */
export function buildPartnerLink(code: string, origin: string = appOrigin()): string {
  const params = new URLSearchParams({
    ref: code,
    utm_source: 'partner',
    utm_medium: 'qr',
    utm_campaign: 'corner_depot',
  })
  return `${origin}/?${params.toString()}`
}

/** Build a self-contained SVG string encoding `text` as a QR code. */
export function buildQrSvg(text: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true })
}

/** Trigger a browser download of an SVG string. */
export function downloadSvg(filename: string, svg: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
