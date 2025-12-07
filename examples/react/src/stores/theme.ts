import { persistentAtom } from '@nanostores/persistent'
import { computed } from 'nanostores'

export type Theme = 'light' | 'dark' | 'system'

// Persistent theme preference
export const themePreference = persistentAtom<Theme>('theme', 'system', {
  encode: JSON.stringify,
  decode: (str) => {
    const value = JSON.parse(str)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  },
})

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Computed effective theme
export const effectiveTheme = computed(themePreference, (preference) => {
  return preference === 'system' ? getSystemTheme() : preference
})

// Apply theme to document
export function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return

  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Initialize theme system
export function initTheme() {
  if (typeof window === 'undefined') return

  // Apply initial theme
  applyTheme(effectiveTheme.get())

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    if (themePreference.get() === 'system') {
      applyTheme(effectiveTheme.get())
    }
  }
  mediaQuery.addEventListener('change', handleChange)

  // Listen for theme preference changes
  const unsubscribe = effectiveTheme.subscribe((theme) => {
    applyTheme(theme)
  })

  return () => {
    mediaQuery.removeEventListener('change', handleChange)
    unsubscribe()
  }
}

// Set theme preference
export function setTheme(theme: Theme) {
  themePreference.set(theme)
}
