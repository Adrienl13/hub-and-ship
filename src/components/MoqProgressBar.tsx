import { Check, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import type { MoqStatus } from '@/lib/order'

const TONE_CLASSES: Record<MoqStatus['tone'], string> = {
  success:
    'bg-[color:var(--forest)]/12 text-[color:var(--forest)] border-[color:var(--forest)]/25',
  amber:
    'bg-[color:var(--ember)]/10 text-[color:var(--ember)] border-[color:var(--ember)]/25',
  ochre:
    'bg-[color:var(--ochre)]/10 text-[color:var(--ochre)] border-[color:var(--ochre)]/25',
  neutral: 'bg-muted text-muted-foreground border-border',
}

const TONE_BAR: Record<MoqStatus['tone'], string> = {
  success: 'bg-[color:var(--forest)]',
  amber: 'bg-[color:var(--ember)]',
  ochre: 'bg-[color:var(--ochre)]',
  neutral: 'bg-[color:var(--ink-soft)]',
}

export function MoqProgressBar({
  label,
  status,
}: {
  label: string
  status: MoqStatus
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="label-eyebrow text-muted-foreground">{label}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={status.status + status.label}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${TONE_CLASSES[status.tone]}`}
          >
            {status.status === 'reached' ? (
              <Check className="h-3 w-3" strokeWidth={2.5} />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {status.label}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-[color:var(--sand-deep)]">
        <motion.div
          className={`h-full ${TONE_BAR[status.tone]}`}
          initial={false}
          animate={{ width: `${Math.min(100, status.percent)}%` }}
          transition={{ type: 'spring', stiffness: 110, damping: 20 }}
        />
        {status.status === 'reached' && (
          <motion.div
            className="absolute inset-y-[-2px] w-[40%] -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
            animate={{ x: ['-100%', '260%'] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              repeatDelay: 1.2,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>
    </div>
  )
}
