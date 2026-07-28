import { ui } from '../locale/ui'
import { useThemeStore, themes } from '../store/theme'

export function ThemeCard({ onChange }: { onChange?: (themeId: string) => void }) {
  const themeId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)
  const active = themes.find((t) => t.id === themeId)
  return (
    <div className="theme-card">
      <div className="theme-card__header">
        <span className="theme-card__title">{ui.theme.cardTitle}</span>
        <span className="theme-card__active">{active?.label}</span>
      </div>
      <div className="theme-card__swatches">
        {themes.map((t) => (
          <button
            key={t.id}
            className={`theme-swatch${themeId === t.id ? ' is-active' : ''}`}
            style={{ ['--c' as string]: t.swatch }}
            onClick={() => {
              setTheme(t.id)
              onChange?.(t.id)
            }}
            title={t.label}
            aria-label={t.label}
          />
        ))}
      </div>
    </div>
  )
}
