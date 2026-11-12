/** Browser entry for the scheme suite: exposes the shipped `setScheme` to a static document. */
import { setScheme } from '../../../src/core/scheme'

Object.assign(window, { basaltScheme: { setScheme } })
