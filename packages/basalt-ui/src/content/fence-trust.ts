import { createContext } from 'react'
import type { UrlTrust } from '../core/url'

/**
 * The trust of the Markdown a fence sits in, read by renderers that load remote resources
 * (`MermaidDiagram`: images and links). The default is `untrusted`: a diagram outside `Markdown`, or
 * a pipeline that provides nothing, gets the strict policy.
 */
export const FenceTrust = createContext<UrlTrust>('untrusted')
