import { useCallback, useEffect, useState } from 'react'
import type { UpdaterPushPayload } from '@api-tester/shared'
import { ui } from '../locale/ui'

type Phase = 'hidden' | 'offer' | 'downloading' | 'ready' | 'error'

export function UpdateBanner() {
  const [phase, setPhase] = useState<Phase>('hidden')
  const [version, setVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState<string | undefined>()
  const [percent, setPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const bridge = window.apiTester
    if (!bridge?.updaterSubscribe) return undefined

    const onPush = (p: UpdaterPushPayload) => {
      switch (p.type) {
        case 'checking':
          break
        case 'not-available':
          setPhase((prev) =>
            prev === 'offer' || prev === 'downloading' || prev === 'ready' ? prev : 'hidden'
          )
          break
        case 'available':
          setVersion(p.version)
          setReleaseNotes(p.releaseNotes)
          setPhase('offer')
          break
        case 'download-progress':
          setPhase('downloading')
          setPercent(Math.round(p.percent))
          break
        case 'downloaded':
          setVersion(p.version)
          setPhase('ready')
          break
        case 'error':
          setErrorMessage(p.message)
          setPhase('error')
          break
        default:
          break
      }
    }

    const unsub = bridge.updaterSubscribe(onPush)
    return () => unsub()
  }, [])

  const onDownload = useCallback(() => {
    void window.apiTester?.updaterDownload?.()
  }, [])

  const onRestart = useCallback(() => {
    void window.apiTester?.updaterQuitAndInstall?.()
  }, [])

  const onDismissError = useCallback(() => {
    setPhase('hidden')
    setErrorMessage('')
  }, [])

  const onRecheck = useCallback(() => {
    setPhase('hidden')
    setErrorMessage('')
    void window.apiTester?.updaterCheck?.()
  }, [])

  if (phase === 'hidden') return null

  return (
    <div className="update-banner" role="status">
      {phase === 'offer' && (
        <>
          <span className="update-banner__text">
            {ui.update.available(version)}
            {releaseNotes ? (
              <span className="update-banner__notes" title={releaseNotes}>
                {releaseNotes.split('\n')[0]}
              </span>
            ) : null}
          </span>
          <button type="button" className="btn btn--primary btn--sm" onClick={onDownload}>
            {ui.update.download}
          </button>
        </>
      )}
      {phase === 'downloading' && (
        <>
          <span className="update-banner__text">{ui.update.downloading(percent)}</span>
          <div className="update-banner__progress" aria-hidden>
            <div className="update-banner__progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
      {phase === 'ready' && (
        <>
          <span className="update-banner__text">{ui.update.ready(version)}</span>
          <span className="update-banner__hint muted">{ui.update.dataKept}</span>
          <button type="button" className="btn btn--primary btn--sm" onClick={onRestart}>
            {ui.update.restart}
          </button>
        </>
      )}
      {phase === 'error' && (
        <>
          <span className="update-banner__text update-banner__text--err">{errorMessage}</span>
          <button type="button" className="btn btn--sm" onClick={onRecheck}>
            {ui.update.retry}
          </button>
          <button type="button" className="btn btn--sm" onClick={onDismissError}>
            {ui.update.dismiss}
          </button>
        </>
      )}
    </div>
  )
}
