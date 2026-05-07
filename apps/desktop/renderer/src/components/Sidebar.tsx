import { useState } from 'react'
import {
  IconApis,
  IconCollections,
  IconEnv,
  IconFlow,
  IconHistory,
  IconMock,
  IconMonitor,
  IconSettings,
} from './icons'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const items: NavItem[] = [
  { id: 'collections', label: 'Collections', icon: IconCollections },
  { id: 'environments', label: 'Environments', icon: IconEnv },
  { id: 'history', label: 'History', icon: IconHistory },
  { id: 'apis', label: 'APIs', icon: IconApis },
  { id: 'mock', label: 'Mock Servers', icon: IconMock },
  { id: 'monitors', label: 'Monitors', icon: IconMonitor },
  { id: 'flows', label: 'Flows', icon: IconFlow },
  { id: 'settings', label: 'Settings', icon: IconSettings },
]

export function Sidebar() {
  const [active, setActive] = useState('collections')
  return (
    <aside className="rail app__rail">
      <div className="rail__brand" title="JadeAPI Studio">JA</div>
      <div className="rail__items">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`rail__item${active === item.id ? ' is-active' : ''}`}
              onClick={() => setActive(item.id)}
              title={item.label}
            >
              <Icon />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
