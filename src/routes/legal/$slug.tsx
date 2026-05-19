import { createFileRoute, notFound } from "@tanstack/react-router";

import { LegalLayout, LEGAL_PAGES, type LegalSlug } from "@/components/LegalLayout";
import { getLegalDoc } from "@/lib/legal-content";

const VALID_SLUGS: ReadonlyArray<LegalSlug> = LEGAL_PAGES.map((p) => p.slug);

function isValidSlug(value: string): value is LegalSlug {
  return (VALID_SLUGS as ReadonlyArray<string>).includes(value);
}

export const Route = createFileRoute("/legal/$slug")({
  beforeLoad: ({ params }) => {
    if (!isValidSlug(params.slug)) {
      throw notFound();
    }
  },
  component: LegalDocPage,
  head: ({ params }) => {
    const slug = params?.slug;
    const doc = slug && isValidSlug(slug) ? getLegalDoc(slug) : undefined;
    if (!doc) {
      return { meta: [{ title: "Document légal — Container Club" }] };
    }
    return {
      meta: [
        { title: `${doc.title} — Container Club` },
        { name: "description", content: doc.metaDescription },
      ],
    };
  },
});

function LegalDocPage() {
  const { slug } = Route.useParams();
  if (!isValidSlug(slug)) {
    throw notFound();
  }
  const doc = getLegalDoc(slug);
  if (!doc) {
    throw notFound();
  }

  return (
    <LegalLayout slug={doc.slug} title={doc.title} updatedAt={doc.updatedAt}>
      {doc.content}
    </LegalLayout>
  );
}
