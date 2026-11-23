export interface FixtureApi {
  requestDisclosure?: (open: boolean) => void
  setExternal: (value: string) => void
  /** Replaces search candidates to exercise retention of committed choices. */
  setOptions: () => void
  setLongMessage: (language: string) => void
  replaceMenuTrigger: (position: 'near' | 'far') => void

  submitSample?: () => Promise<boolean>
  /** Switches the editor to another record under the same native form. */
  selectSample?: (id: string) => void
  /** Holds or rejects a write to the selected record. */
  commitSample?: (submitter: HTMLElement | null, id: string) => Promise<void>

  setOwner: (mounted: boolean) => void
  showLoading: (persistent: boolean) => void
  updateToast: () => void
  dismissToast: () => void
  rootToast: () => void

  /** Returns borrowed editor text, or an empty string after release. */
  editorText?: () => string
  editorSet?: (value: string) => void
  editorSelect?: () => void
  editorReleased?: boolean
  setSourceOnly?: (sourceOnly: boolean) => void

  dispose: () => void
}

declare global {
  interface Window {
    fixture: FixtureApi
  }
}
