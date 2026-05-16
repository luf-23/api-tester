import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

type Props = {
  open: boolean
  className?: string
  onBackdropClick?: () => void
  children: ReactNode
}

export function AnimatedOverlay({
  open,
  className = 'confirm-overlay',
  onBackdropClick,
  children,
}: Props) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={className}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.14 }}
          onClick={onBackdropClick}
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
