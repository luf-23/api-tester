import { ui } from '../locale/ui'
import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'

export function StatusBar() {
  const openIds = useTabsStore((s) => s.openIds)
  const activeId = useTabsStore((s) => s.activeId)
  const collections = useWorkspaceStore((s) => s.collections)
  const activeRequest = activeId ? useWorkspaceStore.getState().getRequest(activeId) : undefined

  const reqCount = collections.reduce((n, c) => {
    function walk(node: (typeof c)['root']): number {
      let k = 0
      for (const ch of node.children) {
        k += 'method' in ch ? 1 : walk(ch)
      }
      return k
    }
    return n + walk(c.root)
  }, 0)

  return (
    <footer className="statusbar">
      <span className="statusbar__section statusbar__section--strong">
        <span className="statusbar__online-dot" aria-hidden />
        {ui.statusBar.local} workspace
      </span>
      <span className="statusbar__sep" aria-hidden />
      <span className="statusbar__muted">
        {ui.statusBar.collections(collections.length)} · {ui.statusBar.requests(reqCount)}
      </span>
      <span className="statusbar__spacer" />
      {activeRequest && (
        <span className="statusbar__request-url" title={activeRequest.url}>
          {activeRequest.url || 'URL not set'}
        </span>
      )}
      {activeId && (
        <span className="statusbar__muted">
          {ui.statusBar.tabIndex(openIds.indexOf(activeId) + 1, openIds.length)}
        </span>
      )}
    </footer>
  )
}
