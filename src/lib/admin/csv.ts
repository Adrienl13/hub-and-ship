// Minimal, dependency-free CSV builder for admin exports. Handles quoting
// (commas, quotes, newlines), and prepends a UTF-8 BOM so accented French text
// opens correctly in Excel. Pure + unit tested.

export interface CsvColumn<T> {
  readonly header: string
  readonly value: (row: T) => string | number | null | undefined
}

function escapeCell(raw: string | number | null | undefined): string {
  const value = raw === null || raw === undefined ? '' : String(raw)
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function toCsv<T>(
  rows: ReadonlyArray<T>,
  columns: ReadonlyArray<CsvColumn<T>>,
): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
    .join('\r\n')
  return body ? `${header}\r\n${body}` : header
}

/** Triggers a browser download of a CSV string (UTF-8 with BOM for Excel). */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return
  // UTF-8 BOM so Excel detects the encoding and renders accents correctly.
  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
