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

  navigate(target: NativeViewTarget | SearchTarget, call?: CallOptions): Promise<void>

  openSearch(call?: CallOptions): Promise<void>

  openExternal(url: string, call?: CallOptions): Promise<void>
}
