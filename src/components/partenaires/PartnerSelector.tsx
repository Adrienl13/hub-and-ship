import {
  PARTNER_ACTIVITY_PROFILES,
  PARTNER_ACTIVITY_PROFILE_LABEL,
  type PartnerActivityProfile,
} from '@/lib/partner-applications'
import { SELECTOR_RECO } from './data'

export function PartnerSelector({
  activeProfile,
  onSelect,
}: {
  readonly activeProfile: PartnerActivityProfile | null
  readonly onSelect: (profile: PartnerActivityProfile) => void
}) {
  const reco = activeProfile ? SELECTOR_RECO[activeProfile] : null

  return (
    <section className="py-11">
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-6 shadow-paper">
          <span className="mono block text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
            Orientation
          </span>
          <h2 className="mt-2 text-xl font-extrabold">
            Trouvez votre statut en 10 secondes — quelle est votre activité ?
          </h2>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {PARTNER_ACTIVITY_PROFILES.filter((p) => p !== 'autre').map(
              (profile) => {
                const pressed = activeProfile === profile
                return (
                  <button
                    key={profile}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onSelect(profile)}
                    className={`rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors ${
                      pressed
                        ? 'border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--sand-soft)]'
                        : 'border-[color:var(--border-strong)] bg-[color:var(--sand-soft)] hover:border-[color:var(--ink)]'
                    }`}
                  >
                    {PARTNER_ACTIVITY_PROFILE_LABEL[profile]}
                  </button>
                )
              },
            )}
          </div>
          {reco && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-r-md border-l-[3px] border-[color:var(--ember)] bg-[color:var(--ember-soft)] px-4 py-3.5 text-[14.5px]"
            >
              {reco.note}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
