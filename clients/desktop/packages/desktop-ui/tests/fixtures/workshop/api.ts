/** @fileoverview Test-owned controls for external updates and resource-lifetime observations. */

/** Browser-test hooks controlling the isolated consumer and observing its resource lifetimes. */
export interface FixtureApi {
  /** Replaces the controlled text value from outside its native input. */
  setExternal: (value: string) => void
  /** Replaces search candidates to exercise retention of committed choices. */
  setOptions: () => void
  /** Installs long multilingual feedback prefixed by the requested language label. */
  setLongMessage: (language: string) => void

  /** Mounts or disposes the component that publishes fixture notifications. */
  setOwner: (mounted: boolean) => void
  /** Publishes a synthetic loading message with the requested persistence policy. */
  showLoading: (persistent: boolean) => void
  /** Updates the current fixture message to its successful result. */
  updateToast: () => void
  /** Dismisses the fixture's current message through its retained handle. */
  dismissToast: () => void
  /** Publishes a persistent message from the workshop root. */
  rootToast: () => void

  /** Returns borrowed editor text, or an empty string after release. */
  editorText?: () => string
  /** Replaces the Markdown source through its external value owner. */
  editorSet?: (value: string) => void
  /** Selects the sample heading text in the borrowed editor. */
  editorSelect?: () => void
  editorReleased?: boolean
  /** Toggles the source-only fixture by hiding or restoring toolbar composition. */
  setSourceOnly?: (sourceOnly: boolean) => void

  /** Disposes the mounted workshop root and its presentation and capability resources. */
  dispose: () => void
}

declare global {
  /** Window augmentation exposing the isolated UI consumer's test hooks. */
  interface Window {
    fixture: FixtureApi
  }
}
