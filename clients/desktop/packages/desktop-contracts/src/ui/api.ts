import type { CallOptions } from '../operations'
import type { ExtensionPagesApi } from './pages'
import type { ExtensionDialogsApi } from './views'
import type { ExtensionMenusApi } from './menus'
import type { ToastApi } from './feedback'
import type { NativeViewTarget, SearchTarget } from './navigation'

export interface UiApi {
  readonly pages: ExtensionPagesApi
  readonly dialogs: ExtensionDialogsApi
  readonly menus: ExtensionMenusApi
  readonly toast: ToastApi

  /**
   * Opens an explicit native or search destination through its owner, applying target and
   * visibility checks.
   */
  navigate(target: NativeViewTarget | SearchTarget, call?: CallOptions): Promise<void>

  /**
   * Makes the main-window search panel visible and resolves at visibility.
   *
   * Content windows do not expose this operation.
   */
  openSearch(call?: CallOptions): Promise<void>

  /**
   * Validates an absolute credential-free HTTP(S) URL and hands it to the system browser.
   *
   * Rejected navigation is reported without an automatic retry.
   */
  openExternal(url: string, call?: CallOptions): Promise<void>
}
