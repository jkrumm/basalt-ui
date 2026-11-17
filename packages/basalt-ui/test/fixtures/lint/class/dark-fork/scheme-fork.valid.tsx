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
