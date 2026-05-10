import { create } from 'zustand'

export interface ThemeOption {
  id: string
  label: string
  swatch: string
  mood: 'Energetic' | 'Focused' | 'Balanced'
}

export const themes: ThemeOption[] = [
  { id: 'jade-light', label: '翡翠绿', swatch: '#6fb24c', mood: 'Energetic' },
  { id: 'jade-porcelain', label: '素白', swatch: '#e8eaef', mood: 'Focused' },
  { id: 'jade-sage', label: '鼠尾草', swatch: '#7d9c5b', mood: 'Focused' },
  { id: 'jade-lime', label: '青柠', swatch: '#b9d630', mood: 'Energetic' },
  { id: 'jade-cream', label: '奶油', swatch: '#e6daab', mood: 'Balanced' },
  { id: 'jade-apricot', label: '蜜橘', swatch: '#f0a068', mood: 'Balanced' },
  { id: 'jade-coral', label: '珊瑚', swatch: '#d65a3a', mood: 'Energetic' },
  { id: 'jade-clay', label: '陶土', swatch: '#a26b3f', mood: 'Balanced' },
  { id: 'jade-dark', label: '午夜', swatch: '#0e1612', mood: 'Focused' },
]

interface ThemeState {
  themeId: string
  setTheme: (id: string) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'jade-porcelain',
  setTheme: (id) => {
    document.documentElement.setAttribute('data-theme', id)
    set({ themeId: id })
  },
}))
