/** The part of a React keyboard event an IME-aware Enter check reads. */
export type CommitKeyEvent = {
  key: string
  keyCode: number
  nativeEvent: { isComposing: boolean }
}

/**
 * True for the keydown that belongs to an IME composition: `isComposing`, or the legacy `keyCode`
 * 229 that Safari reports for the Enter that follows `compositionend`.
 */
export const confirmsComposition = (event: CommitKeyEvent): boolean =>
  event.nativeEvent.isComposing || event.keyCode === 229

/** Whether a keydown is an Enter that commits a draft: never the one that confirms an IME candidate. */
export const commitsDraft = (event: CommitKeyEvent): boolean =>
  event.key === 'Enter' && !confirmsComposition(event)
