import { IconChevRight, IconConsole, IconGlobe, IconRunner, IconTrash } from './icons'

export function StatusBar() {
  return (
    <footer className="statusbar app__statusbar">
      <span className="statusbar__pill">
        <span className="statusbar__dot" />
        All Systems Operational
        <IconChevRight width={12} height={12} />
      </span>
      <button className="statusbar__btn">
        <IconConsole /> Console
      </button>
      <button className="statusbar__btn">
        <IconRunner /> Runner
      </button>
      <button className="statusbar__btn">
        <IconTrash /> Trash
      </button>
      <span className="statusbar__spacer" />
      <button className="statusbar__btn">
        <IconGlobe /> Online
      </button>
      <span>v1.0.0</span>
      <button className="statusbar__btn">Help</button>
    </footer>
  )
}
