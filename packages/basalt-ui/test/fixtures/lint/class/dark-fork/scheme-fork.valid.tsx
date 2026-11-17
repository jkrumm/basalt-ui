export const Well = () => <div className="bg-inset">w</div>
export function Code({ resolvedTheme }) {
  const shiki = resolvedTheme === 'dark' ? 'github-dark' : 'github-light'
  return <CodeBlock theme={shiki} />
}
export const Toggle = ({ theme }) => (
  <button type="button" aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} />
)
export const Open = ({ open }) => <div className={open ? 'bg-inset' : 'bg-card'} />
export const Mode = ({ mode }) => <div className={mode === 'dark' ? 'bg-inset' : 'bg-card'} />
export const Motion = () => (
  <div className={window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'p-2' : 'p-4'} />
)
export function lockScroll() {
  document.body.classList.add('overflow-hidden')
}
export const preview = (node) => node.classList.toggle('dark', true)
export const Badge = ({ active }) => <i className={cn({ 'opacity-90': active })} />
export function Track({ isDark }) {
  track('open', { isDark })
}
export function Banner() {
  const wide = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return <div className={wide ? 'p-2' : 'p-4'} />
}
const tag = cva('px-2', { variants: { tone: { dark: 'bg-inset', muted: 'bg-card' } } })
export const Tag = ({ tone }) => <i className={tag({ tone })} />
export function Panel({ open }) {
  const shown = useMemo(() => open === true, [open])
  return <div className={shown ? 'opacity-90' : 'opacity-100'} />
}
export function Calm() {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)')
  return <div className={reduce ? 'p-2' : 'p-4'} />
}
export function markState(state) {
  document.documentElement.setAttribute('data-state', state)
  document.documentElement.className = 'js'
}
export const previewTheme = (node, next) => node.setAttribute('data-theme', next)
export function markTouch() {
  if (navigator.maxTouchPoints > 0) document.documentElement.classList.add('is-touch')
}
