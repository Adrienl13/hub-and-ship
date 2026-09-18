import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      // Les barres de commande fixes (catalogue, accueil mobile) occupent le
      // bas de l'écran : les toasts remontent au-dessus au lieu de recouvrir
      // les boutons Confirmer / Devis (retour validation desktop 08/2026).
      offset={{ bottom: 84 }}
      mobileOffset={{ bottom: 96 }}
      toastOptions={{
        classNames: {
          // `font-sans` = la police du site (serif) depuis tailwind.config.
          // Sans elle, sonner impose sa propre pile système et les messages
          // d'erreur s'affichaient en grotesque au milieu d'une page serif.
          toast:
            'group toast font-sans group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
