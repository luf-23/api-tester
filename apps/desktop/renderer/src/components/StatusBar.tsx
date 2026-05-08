import { useTabsStore } from '../store/tabs'
import { useWorkspaceStore } from '../store/workspace'

export function StatusBar() {
  const openIds = useTabsStore((s) => s.openIds)
  const activeId = useTabsStore((s) => s.activeId)
  const collections = useWorkspaceStore((s) => s.collections)

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
      <span className="statusbar__section statusbar__section--strong">Local</span>
      <span className="statusbar__sep" aria-hidden />
      <span className="statusbar__muted">
        {collections.length} collection{collections.length === 1 ? '' : 's'} · {reqCount}{' '}
        request{reqCount === 1 ? '' : 's'}
      </span>
      <span className="statusbar__spacer" />
      {activeId && (
        <span className="statusbar__muted">
          Tab {openIds.indexOf(activeId) + 1} / {openIds.length}
        </span>
      )}
    </footer>
  )
}
