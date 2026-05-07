import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { CollectionsPanel } from './components/CollectionsPanel'
import { TopBar } from './components/TopBar'
import { RequestPanel } from './components/RequestPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { StatusBar } from './components/StatusBar'
import { useWorkspaceStore } from './store/workspace'
import { useTabsStore } from './store/tabs'
import { useThemeStore } from './store/theme'

export default function App() {
  const collections = useWorkspaceStore((s) => s.collections)
  const activeId = useTabsStore((s) => s.activeId)
  const getRequest = useWorkspaceStore((s) => s.getRequest)
  const themeId = useThemeStore((s) => s.themeId)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
  }, [themeId])

  const activeRequest = activeId ? getRequest(activeId) : undefined

  return (
    <div className="app">
      <Sidebar />
      <CollectionsPanel collection={collections[0]} />
      <main className="app__main">
        <TopBar />
        {activeRequest ? (
          <>
            <RequestPanel request={activeRequest} />
            <ResponsePanel requestId={activeRequest.id} />
          </>
        ) : (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
            Select a request from the collection to begin.
          </div>
        )}
      </main>
      <StatusBar />
    </div>
  )
}
