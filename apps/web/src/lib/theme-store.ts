import { atom } from 'nanostores'

type Theme = 'light' | 'dark'

export const themeAtom = atom<Theme>('light')

if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('theme') as Theme | null
  if (stored) themeAtom.set(stored)

  themeAtom.subscribe((theme) => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  })

  document.documentElement.classList.toggle('dark', themeAtom.get() === 'dark')
}
