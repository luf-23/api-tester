import { type RefObject, useLayoutEffect } from 'react'

/**
 * When a row overflows horizontally, map vertical wheel movement to scrollLeft
 * (no visible scrollbar; trackpad horizontal swipe still uses native deltaX).
 */
export function useWheelHorizontalScroll(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const onWheel = (e: WheelEvent): void => {
      if (el.scrollWidth <= el.clientWidth + 1) return
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return

      const max = Math.max(0, el.scrollWidth - el.clientWidth)
      const dy = e.deltaY
      const sl = el.scrollLeft
      const next = sl + dy

      if (dy < 0 && sl <= 0) return
      if (dy > 0 && sl >= max - 0.5) return

      el.scrollLeft = Math.max(0, Math.min(max, next))
      e.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref])
}
