/**
 * Registers a loader that resolves any `.css` import (plain or CSS-module) to an empty module, so
 * the built dist/ can be imported under plain Node for export-surface snapshotting — components
 * import `*.module.css` at module top level, which Node cannot load natively.
 * Usage: node --import <this file> <script>
 */
import { register } from 'node:module'

register(new URL('./css-noop-loader.mjs', import.meta.url))
