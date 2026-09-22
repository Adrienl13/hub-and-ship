/* global document */

/**
 * Le menu déroulant mobile de la barre publique.
 *
 * Le repli lui-même est en CSS (`shell.css`, bloc « Menu déroulant mobile ») :
 * il dépend de `aria-expanded` sur le bouton, donc l'état visuel et l'état
 * annoncé aux lecteurs d'écran ne peuvent pas diverger. Ce fichier ne fait
 * que basculer cet attribut, et refermer le menu quand il n'a plus lieu
 * d'être ouvert.
 *
 * Volontairement absent : aucun `display` piloté ici. Une fois l'état posé
 * en JavaScript ET en CSS, on se retrouve à réparer l'un en cassant l'autre.
 */
export function startNavMenu(root) {
  const toggle = root.querySelector('.nav-toggle')
  const links = root.querySelector('.nav-links')
  if (!toggle || !links) return () => {}

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true'
  const setOpen = (open) =>
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false')

  function onToggleClick() {
    setOpen(!isOpen())
  }

  // Un lien suivi laisse le menu ouvert par-dessus la page d'arrivée quand la
  // navigation reste dans le document (ancres #contact, #studio).
  function onLinkClick(event) {
    if (event.target.closest('a')) setOpen(false)
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape' || !isOpen()) return
    setOpen(false)
    // Rendre le focus au bouton : sans cela il resterait sur un lien devenu
    // invisible, et la tabulation suivante repartirait du haut du document.
    toggle.focus()
  }

  // Un clic en dehors referme : sur un téléphone, le premier réflexe pour
  // annuler est de toucher la page, pas de viser à nouveau le bouton.
  function onDocumentPointerDown(event) {
    if (!isOpen()) return
    if (toggle.contains(event.target) || links.contains(event.target)) return
    setOpen(false)
  }

  toggle.addEventListener('click', onToggleClick)
  links.addEventListener('click', onLinkClick)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('pointerdown', onDocumentPointerDown)

  return () => {
    toggle.removeEventListener('click', onToggleClick)
    links.removeEventListener('click', onLinkClick)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('pointerdown', onDocumentPointerDown)
  }
}
