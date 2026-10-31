/** @fileoverview Defines a document-bound frontend with private Node IPC and only its own host UI/environment capabilities. */

import type {
  AppearancePreview,
  AppearancePreviewInput,
  ViewAppearance,
} from '@kisaki3/desktop-contracts/appearance'
import type { CallOptions, Disposable } from '@kisaki3/desktop-contracts/execution'
import type { UiLocale } from '@kisaki3/desktop-contracts/i18n'
import type { PrivateMethod, ToastApi, WebviewIpc } from '@kisaki3/desktop-contracts/ui'

/** A refreshed document gets a new connection; these methods never expose raw storage, Node files, or desktop domain APIs. */
export interface WebviewContext<
  Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
  Notices extends object = Record<string, unknown>,
> {
  readonly ipc: WebviewIpc<Methods, Notices>
  readonly view: {
    /** Request the shared host close path; a close refusal preserves the current view. */
    close(call?: CallOptions): Promise<void>
    /** Replace the sole close guard, or clear it with undefined. Failure/refusal retains the view. */
    setCloseGuard(handler: (() => boolean | Promise<boolean>) | undefined): void
    /** Observe actual document/view release, not merely a close request. */
    onDispose(cleanup: () => void | Promise<void>): Disposable
  }
  readonly ui: {
    readonly toast: ToastApi
    /** Ask the host to open one explicit credential-free HTTP(S) URL in the system browser. */
    openExternal(url: string, call?: CallOptions): Promise<void>
  }
  readonly appearance: {
    /** Read the complete appearance actually adopted in this document after its fonts were prepared. */
    get(): ViewAppearance
    /** Observe adopted changes; a failed newer preparation leaves the previous complete appearance active. */
    onChanged(listener: (appearance: ViewAppearance) => void): Disposable
    /** Own an application preview through this actual view; replacement or closure releases the previous preview. */
    preview(input: AppearancePreviewInput, call?: CallOptions): Promise<AppearancePreview>
  }
  readonly i18n: {
    readonly locale: {
      /** Read the actual current effective locale; it does not imply any saved translation identity. */
      get(): UiLocale
      /** Observe effective-locale changes for this document. */
      onChanged(listener: (locale: UiLocale) => void): Disposable
    }
  }
}
