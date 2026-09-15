/** Only authored entry links change; editorial anchors and contact remain intact. */
export function studioEntryMarkup(html: string, enabled: boolean): string {
  if (!enabled) return html
  return html.replace(
    /<a\b([^>]*\bdata-studio-entry(?:="")?[^>]*)>/g,
    (_, attributes: string) =>
      '<a' + attributes.replace(/\bhref="[^"]*"/, 'href="/studio"') + '>',
  )
}
