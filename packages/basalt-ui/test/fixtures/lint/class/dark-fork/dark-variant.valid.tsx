export const a = <div className="flex bg-card text-foreground" />
export const label = 'dark: is prose here'
export const b = <div className="darkroom:flex" />
export const c = <div className="data-[theme=light]:flex data-[state=open]:flex" />
export const d = <div className="[[data-theme=light]_&]:flex [.dim_&]:flex" />
export const e = <div className="data-[theme='light']:flex [@media(prefers-color-scheme:light)]:flex" />
export const f = <div className="[@media(prefers-reduced-motion:reduce)]:flex" />
