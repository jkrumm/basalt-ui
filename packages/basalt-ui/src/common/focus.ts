/** The `id` of the shell's one scrollport: the skip link's target and where lost focus lands. */
export const SHELL_MAIN_ID = 'shell-main'

/** Whether focus fell to the document: nothing is focused, or it is `<body>`. */
export function focusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body
}

/** Puts focus on the shell's main (it has `tabindex="-1"`); without a shell there is nothing to do. */
export function focusMain(): void {
  document.getElementById(SHELL_MAIN_ID)?.focus({ preventScroll: true })
}
