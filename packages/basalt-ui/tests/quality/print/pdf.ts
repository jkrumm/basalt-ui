/**
 * Page count of a PDF from its bytes, with no external binary (quality-contract section 4: no
 * poppler). Every page object of a PDF carries `/Type /Page`; the page tree nodes carry `/Type
 * /Pages`, which the negative lookahead keeps out. Chromium's `page.pdf` writes uncompressed object
 * dictionaries, which is what makes the plain scan sound.
 */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes)
  return text.match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0
}
