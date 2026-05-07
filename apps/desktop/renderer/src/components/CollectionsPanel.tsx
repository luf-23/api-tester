import { useMemo, useState } from 'react'
import type { Collection, FolderNode, RequestWithTests } from '@api-tester/shared'
import { useWorkspaceStore } from '../store/workspace'
import { useTabsStore } from '../store/tabs'
import { useThemeStore, themes } from '../store/theme'
import { IconChevDown, IconFilter, IconFolder, IconPlus, IconSearch, IconStar, IconSparkles, IconWorkspace } from './icons'

function isRequest(n: FolderNode | RequestWithTests): n is RequestWithTests {
  return 'method' in n
}
function countRequests(n: FolderNode): number {
  let total = 0
  for (const c of n.children) total += isRequest(c) ? 1 : countRequests(c)
  return total
}

interface FolderRowProps {
  node: FolderNode
  depth: number
  search: string
  rootStar?: boolean
}

function FolderRow({ node, depth, search, rootStar }: FolderRowProps) {
  const expanded = useWorkspaceStore((s) => s.expanded[node.id] ?? false)
  const toggle = useWorkspaceStore((s) => s.toggleFolder)
  const open = useTabsStore((s) => s.open)
  const activeId = useTabsStore((s) => s.activeId)
  const total = countRequests(node)

  const matches = (req: RequestWithTests) =>
    !search || req.name.toLowerCase().includes(search.toLowerCase())

  return (
    <>
      <div
        className="tree-row"
        data-depth={depth}
        onClick={() => toggle(node.id)}
      >
        <IconChevDown className={`tree-row__chev${expanded ? '' : ' is-collapsed'}`} />
        <IconFolder className="tree-row__icon" />
        <span className="tree-row__name">{node.name}</span>
        <span className="tree-row__count">{total} request{total === 1 ? '' : 's'}</span>
        {rootStar && <IconStar className="tree-row__star" width={12} height={12} />}
      </div>
      {expanded && (
        <div className="tree-children">
          {node.children.map((child) => {
            if (isRequest(child)) {
              if (!matches(child)) return null
              return (
                <div
                  key={child.id}
                  className={`tree-row${activeId === child.id ? ' is-active' : ''}`}
                  data-depth={depth + 1}
                  onClick={() => open(child.id)}
                >
                  <span className={`method ${child.method}`}>
                    {child.method === 'DELETE' ? 'DEL' : child.method}
                  </span>
                  <span className="tree-row__name">{child.name}</span>
                </div>
              )
            }
            return <FolderRow key={child.id} node={child} depth={depth + 1} search={search} />
          })}
        </div>
      )}
    </>
  )
}

function ThemeCard() {
  const themeId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)
  return (
    <div className="theme-card">
      <div className="theme-card__title">Jade Theme</div>
      <div className="theme-card__swatches">
        {themes.map((t) => (
          <button
            key={t.id}
            className={`theme-swatch${themeId === t.id ? ' is-active' : ''}`}
            style={{ ['--c' as string]: t.swatch }}
            onClick={() => setTheme(t.id)}
            title={t.label}
          />
        ))}
      </div>
      <div className="theme-card__labels">
        <span>Energetic</span>
        <span>Focused</span>
        <span>Balanced</span>
      </div>
      <button className="theme-card__cta">
        <IconSparkles width={14} height={14} /> Customize Theme
      </button>
    </div>
  )
}

export function CollectionsPanel({ collection }: { collection: Collection }) {
  const [search, setSearch] = useState('')
  const filteredRoot = useMemo(() => collection.root, [collection.root])

  return (
    <div className="collections app__collections">
      <div className="collections__top">
        <div className="workspace-pick">
          <span className="workspace-pick__icon">
            <IconWorkspace width={14} height={14} />
          </span>
          <select defaultValue="acme">
            <option value="acme">Acme Workspace</option>
            <option value="personal">Personal</option>
            <option value="team">Team Sandbox</option>
          </select>
          <button className="icon-btn" title="Workspace settings">
            <IconFilter />
          </button>
        </div>
        <div className="search-row">
          <div className="search-input">
            <IconSearch width={14} height={14} />
            <input
              placeholder="Search collections"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="icon-btn" title="Filter">
            <IconFilter />
          </button>
          <button className="icon-btn is-accent" title="New">
            <IconPlus />
          </button>
        </div>
      </div>
      <div className="tree">
        <FolderRow node={filteredRoot} depth={1} search={search} rootStar />
        <div className="tree-row" data-depth="1">
          <IconChevDown className="tree-row__chev is-collapsed" />
          <IconFolder className="tree-row__icon" />
          <span className="tree-row__name">Shared Collections</span>
          <span className="tree-row__count">3 collections</span>
        </div>
      </div>
      <ThemeCard />
    </div>
  )
}
