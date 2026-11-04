/** @fileoverview Composes the desktop UI capability surface from its actual view, menu and feedback contracts. */

import type { CallOptions } from '../operations'
import type { PagesApi } from './pages'
import type { DialogsApi } from './views'
import type { MenusApi } from './menus'
import type { ToastApi } from './feedback'
import type { NativeViewTarget, SearchTarget } from './navigation'

/** The native module owns complete UI contracts; SDK/window entrypoints explicitly select their authorized subset. */
export interface UiApi {
  readonly pages: PagesApi
  readonly dialogs: DialogsApi
  readonly menus: MenusApi
  readonly toast: ToastApi

  /**
   * Open the explicit native or search destination through its owner, preserving its target and
   * visibility checks.
   */
  navigate(target: NativeViewTarget | SearchTarget, call?: CallOptions): Promise<void>

  /** Wait only for the main-window search panel to become visible; content windows do not expose this operation. */
  openSearch(call?: CallOptions): Promise<void>

  /**
   * Validate a complete credential-free HTTP(S) URL and hand it to the system browser; rejected
   * navigation is not automatically retried here.
   */
  openExternal(url: string, call?: CallOptions): Promise<void>
}
