/** @fileoverview Describes registered native pages and their entry destinations. */

import type { Component } from 'solid-js'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'
import type { NavigationPage } from '../domain-ui/navigation/list'

/** A native business page and the navigation targets it can present. */
export interface PageRoute extends NavigationPage {
  target: NativeViewTarget
  accepts: (target: NativeViewTarget) => boolean
  view: Component<{ api: MainClient; target: NativeViewTarget }>
}

/** Pages are registered by their feature work packages; management surfaces use dialogs. */
export const pages: readonly PageRoute[] = []
