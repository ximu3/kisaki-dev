/**
 * @fileoverview Exposes the selected Solid virtual geometry implementation. Views own row mapping,
 * real identities, selection, loading generations, active-row retention, and anchor restoration.
 */

export { createVirtualizer, createWindowVirtualizer } from '@tanstack/solid-virtual'
export { defaultRangeExtractor } from '@tanstack/virtual-core'
export type {
  Virtualizer,
  VirtualizerOptions,
  VirtualItem,
  Range,
  ScrollToOptions,
} from '@tanstack/virtual-core'
