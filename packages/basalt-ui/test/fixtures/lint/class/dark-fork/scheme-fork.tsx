// expect: resolvedTheme === 'dark'
// expect: scheme === 'dark'
// expect: theme !== 'light'
// expect: colorScheme === 'dark'
// expect: resolvedTheme === 'dark'
// expect: matchMedia('(prefers-color-scheme: dark)').matches
// expect: resolvedTheme === 'dark'
// expect: isDarkMode
// expect: dark, bound to matchMedia('(prefers-color-scheme: dark)').matches
// expect: darkMode
// expect: root.classList.remove
// expect: root.classList.add
// expect: document.documentElement.classList.toggle
// expect: document.body.classList.add
// expect: variants.scheme: { dark, light }
// expect: memoDark, bound to useMemo(() => resolvedTheme === 'dark')
// expect: prefersDark, bound to useMediaQuery('(prefers-color-scheme: dark)')
// expect: isDarkNow(), bound to useCallback(() => theme === 'dark')
// expect: resolvedTheme === 'dark'
// expect: document.documentElement.setAttribute('data-theme')
// expect: root.dataset.theme
// expect: document.documentElement.className
export function Well() {
  const { resolvedTheme } = useTheme()
  return <div className={resolvedTheme === 'dark' ? 'bg-inset' : 'bg-card'}>w</div>
}
export function Logo() {
  const scheme = readScheme()
  return <div className={cn('p-2', scheme === 'dark' ? 'text-faint' : 'text-foreground')}>l</div>
}
export const Chip = ({ theme }) => (
  <span className={'light' !== theme ? 'bg-inset' : 'bg-card'}>c</span>
)
export const Row = ({ settings }) => (
  <div className={settings.colorScheme === 'dark' ? 'bg-inset' : 'bg-card'}>r</div>
)
export const Edge = ({ resolvedTheme }) => (
  <hr className={cn('border-t', resolvedTheme === 'dark' && 'border-strong')} />
)
export const Os = () => (
  <div
    className={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'bg-inset' : 'bg-card'}
  />
)
export const Avatar = ({ resolvedTheme }) => (
  <img alt="" className={cn('size-8', { invert: resolvedTheme === 'dark' })} />
)
export function Mark() {
  const { isDarkMode } = useDarkMode()
  return <img alt="" className={isDarkMode ? 'invert' : ''} />
}
export function Hero() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return <div className={dark ? 'opacity-90' : 'opacity-100'} />
}
export const Flip = ({ darkMode }) => <i className={cn(!darkMode && 'opacity-90')} />
export function applyTheme(theme) {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
}
export const flip = (on) => document.documentElement.classList.toggle('dark', on)
export const bodyLight = () => document.body.classList.add('light')
const logo = cva('size-8', { variants: { scheme: { dark: 'invert', light: '' } } })
export const Logo2 = ({ resolvedTheme }) => (
  <img alt="" className={logo({ scheme: resolvedTheme })} />
)
export function Avatar2({ resolvedTheme }) {
  const memoDark = useMemo(() => resolvedTheme === 'dark', [resolvedTheme])
  return <img alt="" className={memoDark ? 'opacity-90' : 'opacity-100'} />
}
export function Chip2() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  return <span className={cn('rounded-sm', prefersDark && 'opacity-80')}>c</span>
}
export function Dot({ theme }) {
  const isDarkNow = useCallback(() => theme === 'dark', [theme])
  return <i className={isDarkNow() ? 'opacity-90' : ''} />
}
export const Hole = ({ resolvedTheme }) => (
  <div className={`flex ${resolvedTheme === 'dark' ? 'opacity-90' : ''}`} />
)
export function applyScheme(next) {
  document.documentElement.setAttribute('data-theme', next)
}
export function applyScheme2(next) {
  const root = document.documentElement
  root.dataset.theme = next
}
export function boot(stored) {
  document.documentElement.className = stored === 'dark' ? 'dark' : ''
}
