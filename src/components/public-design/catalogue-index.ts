// L'index du catalogue que lisent les robots.
//
// Constat du 19/09, en interrogeant le site en tant que Bingbot : la page
// /catalogue rend 2 949 caractères de texte côté serveur, et ZÉRO produit.
// Les fiches sont construites dans le navigateur (`startPage` est appelé
// depuis un `useEffect`), donc tout ce qu'un robot sans JavaScript en retire
// est « Chargement du catalogue… ».
//
// Google exécute le JS ; Bing le fait bien moins fiablement, et la plupart
// des robots d'IA pas du tout. Conséquences mesurées :
//   - aucun lien interne vers les 189 fiches — elles ne sont atteignables
//     que par le sitemap, et une page orpheline se classe moins bien ;
//   - /catalogue est une page mince pour Bing ;
//   - les IA qui citent des sources ne voient ni produit ni prix.
//
// On rend donc la liste côté serveur, dans le HTML initial. Ce n'est pas du
// texte caché : c'est exactement ce que le visiteur voit une fois la grille
// chargée, et c'est ce que voit un visiteur SANS JavaScript. Le script
// client la retire dès qu'il prend la main (`#catalogue-ssr-index`), avant
// peinture, pour ne pas la doubler avec la vraie grille — le binder INSÈRE
// ses cartes sans effacer ce qui précède.

/** Ce dont l'index a besoin : un nom, un lien, un prix. */
export interface CatalogueIndexItem {
  readonly name: string
  readonly path: string
  readonly price: string
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Les noms viennent de la base : ils sont échappés avant d'entrer dans le
 *  HTML, qui est injecté par `dangerouslySetInnerHTML`. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)
}

/** Marqueur posé dans template.html, remplacé au rendu serveur. */
export const CATALOGUE_INDEX_MARKER = '<!--catalogue-ssr-index-->'

/**
 * Construit l'index. Rend une chaîne vide si la liste est vide — une base
 * indisponible ne doit pas produire une section « Tous nos modèles » sans
 * modèle, que les robots liraient comme un catalogue vide.
 */
export function catalogueIndexMarkup(
  items: ReadonlyArray<CatalogueIndexItem>,
): string {
  if (items.length === 0) return ''
  const links = items
    .map(
      (item) =>
        `<li><a href="${escapeHtml(item.path)}">${escapeHtml(item.name)}` +
        (item.price ? ` — ${escapeHtml(item.price)}` : '') +
        `</a></li>`,
    )
    .join('')
  return (
    `<nav id="catalogue-ssr-index" class="wrap" aria-label="Tous nos modèles">` +
    `<h2>Tous nos modèles</h2><ul>${links}</ul></nav>`
  )
}

/** Insère l'index à la place du marqueur du gabarit. */
export function withCatalogueIndex(
  html: string,
  items: ReadonlyArray<CatalogueIndexItem>,
): string {
  if (!html.includes(CATALOGUE_INDEX_MARKER)) return html
  return html.replace(CATALOGUE_INDEX_MARKER, catalogueIndexMarkup(items))
}
