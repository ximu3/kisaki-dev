export interface FixtureApi {
  requestDisclosure?: (open: boolean) => void
  setExternal: (value: string) => void
  setOptions: () => void
  setLongMessage: (language: string) => void
  replaceMenuTrigger: (position: 'near' | 'far') => void
  setSampleTableDirection: (direction: 'ltr' | 'rtl') => void
  scrollSampleToEnd: (index: number) => void

  submitSample?: () => Promise<boolean>
  selectSample?: (id: string) => void
  commitSample?: (submitter: HTMLElement | null, id: string) => Promise<void>

  setOwner: (mounted: boolean) => void
  showLoading: (persistent: boolean) => void
  updateToast: () => void
  dismissToast: () => void
  rootToast: () => void

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
