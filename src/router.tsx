import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

// Composant d'erreur GLOBAL : sans lui, TanStack affichait son défaut
// anglais « Something went wrong! Show Error » — que Google a indexé comme
// titre du site (constat 08/2026). Version brandée, en français, avec
// <title> et robots noindex hoistés dans le <head> par React 19 : un état
// d'erreur ne doit jamais être indexé. Liens en <a> natifs — le routeur
// peut être l'origine du crash.
function AppErrorComponent({ reset }: { reset?: () => void }) {
  return (
    <>
      <title>Un incident est survenu — Terrassea</title>
      <meta name="robots" content="noindex, nofollow" />
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Incident technique
        </div>
        <h1 className="mt-2 font-display text-4xl tracking-tight">
          Un incident est survenu.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Nos équipes sont prévenues. Rechargez la page — si le problème
          persiste, écrivez-nous à adrienlaniez1@gmail.com et nous vous
          répondrons rapidement.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              reset?.()
              window.location.reload()
            }}
            className="hover:bg-foreground/90 inline-flex h-11 items-center rounded-sm bg-foreground px-4 text-sm font-medium text-background"
          >
            Recharger la page
          </button>
          <a
            href="/"
            className="hover:border-foreground/40 inline-flex h-11 items-center rounded-sm border border-[color:var(--sand-deep)] px-4 text-sm font-medium"
          >
            Retour à l&apos;accueil
          </a>
          <a
            href="/catalogue"
            className="hover:border-foreground/40 inline-flex h-11 items-center rounded-sm border border-[color:var(--sand-deep)] px-4 text-sm font-medium"
          >
            Voir le catalogue
          </a>
        </div>
      </main>
    </>
  )
}

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultErrorComponent: AppErrorComponent,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
