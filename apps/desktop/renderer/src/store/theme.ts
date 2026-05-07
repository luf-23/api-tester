import { create } from 'zustand'

export interface ThemeOption {
  id: string
  label: string
  swatch: string
  mood: 'Energetic' | 'Focused' | 'Balanced'
}

export const themes: ThemeOption[] = [
  { id: 'jade-energetic', label: 'Midnight', swatch: '#0e1612', mood: 'Energetic' },
  { id: 'jade-focused', label: 'Forest', swatch: '#3a4a30', mood: 'Focused' },
  { id: 'jade-lime', label: 'Lime', swatch: '#b9d630', mood: 'Energetic' },
  { id: 'jade-cream', label: 'Cream', swatch: '#e6daab', mood: 'Balanced' },
  { id: 'jade-coral', label: 'Coral', swatch: '#f06a55', mood: 'Energetic' },
  { id: 'jade-clay', label: 'Clay', swatch: '#b1825f', mood: 'Balanced' },
  { id: 'jade-balanced', label: 'Sage', swatch: '#c5dc88', mood: 'Balanced' },
]

interface ThemeState {
  themeId: string
  setTheme: (id: string) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'jade-energetic',
  setTheme: (id) => {
    document.documentElement.setAttribute('data-theme', id)
    set({ themeId: id })
  },
}))
