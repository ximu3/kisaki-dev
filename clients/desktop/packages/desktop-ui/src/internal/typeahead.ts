/** @fileoverview Matches timed keyboard prefixes using the language of the focused control. */

import { onCleanup } from 'solid-js'

/** Recognizes one printable grapheme, including composed characters and supplementary code points. */
export function printableKey(key: string): boolean {
  return key !== ' ' && key.length > 0 && graphemes.segment(key).containing(0)?.segment === key
}

/** Grapheme boundaries for keyboard input are independent of the control's case-mapping locale. */
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** Tracks one control's typed prefix and cycles repeated identical graphemes within 700 ms. */
export function createTypeahead() {
  let letters: string[] = []
  let timeout: ReturnType<typeof setTimeout> | undefined
  let scope: HTMLElement | undefined

  /** Ends a prefix when its control loses focus, the search times out, or its owner disposes. */
  function reset(): void {
    clearTimeout(timeout)
    scope?.removeEventListener('focusout', leave)
    scope = undefined
    letters = []
  }

  /** Focus may move among items while a menu's prefix is still being composed. */
  function leave(event: FocusEvent): void {
    if (!(event.relatedTarget instanceof Node) || !scope?.contains(event.relatedTarget)) {
      reset()
    }
  }
  onCleanup(reset)

  return (key: string, control: HTMLElement) => {
    if (scope !== control) {
      reset()
      scope = control
      scope.addEventListener('focusout', leave)
    }
    const language = control.closest('[lang]')?.getAttribute('lang') || undefined
    // HTML can supply an empty or malformed language tag. The runtime default remains usable.
    let resolved: string | undefined
    if (language) {
      try {
        resolved = Intl.getCanonicalLocales(language)[0]
      } catch {
        resolved = undefined
      }
    }
    /** Applies the document language's case mapping to normalized key and label text. */
    const fold = (value: string) => value.normalize('NFC').toLocaleLowerCase(resolved)
    const letter = fold(key)
    letters.push(letter)
    clearTimeout(timeout)
    timeout = setTimeout(reset, 700)
    const prefix = letters.every((item) => item === letter) ? letter : letters.join('')
    return (value: string) => fold(value.trim()).startsWith(prefix)
  }
}
