import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  /** Shown beside the spinner while loading; defaults to children. */
  loadingContent?: ReactNode
  spinnerSize?: 'sm' | 'md'
}

export function LoadingButton({
  loading = false,
  loadingContent,
  spinnerSize = 'sm',
  children,
  disabled,
  className = '',
  ...rest
}: Props) {
  const busy = loading || disabled
  return (
    <button
      type="button"
      {...rest}
      disabled={busy}
      aria-busy={loading || undefined}
      className={`${className}${loading ? ' is-loading' : ''}`.trim()}
    >
      {loading && <Spinner size={spinnerSize} />}
      {loading ? (loadingContent ?? children) : children}
    </button>
  )
}
