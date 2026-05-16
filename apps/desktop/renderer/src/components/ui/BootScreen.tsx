import { motion, useReducedMotion } from 'framer-motion'
import { Spinner } from './Spinner'

export function BootScreen({ message }: { message: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="app app--boot">
      <motion.div
        className="app__boot"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
        role="status"
        aria-live="polite"
      >
        <Spinner size="lg" />
        <span>{message}</span>
      </motion.div>
    </div>
  )
}
