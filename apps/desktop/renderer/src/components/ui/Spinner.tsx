import { Loader2 } from 'lucide-react'

export type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'spinner-icon--sm',
  md: 'spinner-icon--md',
  lg: 'spinner-icon--lg',
}

export function Spinner({
  size = 'md',
  className = '',
  label,
}: {
  size?: SpinnerSize
  className?: string
  /** When set, exposes an accessible status for screen readers. */
  label?: string
}) {
  const icon = (
    <Loader2
      className={`spinner-icon ${SIZE_CLASS[size]}${className ? ` ${className}` : ''}`}
      aria-hidden={label ? undefined : true}
    />
  )
  if (!label) return icon
  return (
    <span className="spinner-with-label" role="status">
      {icon}
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
