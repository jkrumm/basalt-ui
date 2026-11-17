import { defineControls, field } from 'basalt-ui/router'

/** The app's one global store, mounted on the root route: the peek's address, `?peek=record/12`, and the dock's, `?dock=record/12`, on every page. */
export const globals = defineControls({
  id: 'globals',
  scope: 'global',
  fields: { peek: field.string(''), dock: field.string('') },
})
