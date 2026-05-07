import { create } from 'zustand'

export interface ThemeOption {
  id: string
  label: string
  swatch: string
  mood: 'Energetic' | 'Focused' | 'Balanced'
}

export const themes: ThemeOption[] = [
  { id: 'jade-light', label: 'Jade', swatch: '#6fb24c', mood: 'Energetic' },
  { id: 'jade-sage', label: 'Sage', swatch: '#7d9c5b', mood: 'Focused' },
  { id: 'jade-lime', label: 'Lime', swatch: '#b9d630', mood: 'Energetic' },
  { id: 'jade-cream', label: 'Cream', swatch: '#e6daab', mood: 'Balanced' },
  { id: 'jade-coral', label: 'Coral', swatch: '#d65a3a', mood: 'Energetic' },
  { id: 'jade-clay', label: 'Clay', swatch: '#a26b3f', mood: 'Balanced' },
  { id: 'jade-dark', label: 'Midnight', swatch: '#0e1612', mood: 'Focused' },
]

interface ThemeState {
  themeId: string
  setTheme: (id: string) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'jade-light',
  setTheme: (id) => {
    document.documentElement.setAttribute('data-theme', id)
    set({ themeId: id })
  },
}))
