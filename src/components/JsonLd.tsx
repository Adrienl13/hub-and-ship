// Inline JSON-LD injector. Use this when a route's `head().scripts` is not
// reliably emitted in SSR (cf. ISSUE-003 on the /livres index route). Crawlers
// read application/ld+json anywhere in the document, so rendering it in the
// component body is an equivalent, robust alternative to head scripts.

export function JsonLd({ data }: { readonly data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Static, app-controlled data only — never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
