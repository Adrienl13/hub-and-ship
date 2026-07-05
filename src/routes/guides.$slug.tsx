import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowRight, ChevronRight } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { getGuideBySlug } from '@/lib/guides/content'
import {
  articleJsonLd,
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  jsonLdScript,
} from '@/lib/seo'

export const Route = createFileRoute('/guides/$slug')({
  component: GuidePage,
  head: ({ params }) => {
    const guide = getGuideBySlug(params.slug)
    if (!guide) {
      return buildSeoHead({
        title: 'Guide introuvable',
        description: 'Ce guide n’existe pas ou a été déplacé.',
        path: `/guides/${params.slug}`,
        noindex: true,
      })
    }
    const path = `/guides/${guide.slug}`
    return {
      ...buildSeoHead({
        title: guide.title,
        description: guide.metaDescription,
        path,
      }),
      scripts: [
        jsonLdScript(
          articleJsonLd({
            title: guide.title,
            description: guide.metaDescription,
            path,
            datePublished: guide.updated,
          }),
        ),
        jsonLdScript(faqJsonLd(guide.faq)),
        jsonLdScript(
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Guides', path: '/guides' },
            { name: guide.title, path },
          ]),
        ),
      ],
    }
  },
})

function GuidePage() {
  const { slug } = Route.useParams()
  const guide = getGuideBySlug(slug)
  if (!guide) throw notFound()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Accueil
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/guides" className="hover:text-foreground">
            Guides
          </Link>
        </nav>

        <article className="mt-4">
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            {guide.title}
          </h1>

          <div className="mt-5 rounded-md border border-[color:var(--ember)]/30 bg-[color:var(--ember)]/[0.06] p-4">
            <div className="label-eyebrow text-[color:var(--ember)]">
              En bref
            </div>
            <p className="mt-1.5 text-sm leading-7">{guide.answer}</p>
          </div>

          {guide.sections.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {section.heading}
              </h2>
              {section.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="mt-3 text-sm leading-7 text-[color:var(--ink-soft)]"
                >
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 space-y-1.5">
                  {section.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex gap-2 text-sm leading-6 text-[color:var(--ink-soft)]"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--ember)]" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Questions fréquentes
            </h2>
            <dl className="mt-3 divide-y divide-[color:var(--sand-deep)] rounded-md border border-[color:var(--sand-deep)]">
              {guide.faq.map((item) => (
                <div key={item.q} className="px-4 py-3">
                  <dt className="text-sm font-medium">{item.q}</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-10 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Aller plus loin</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {guide.related.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex items-center gap-1.5 text-sm hover:underline"
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-[color:var(--ember)]" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  )
}
