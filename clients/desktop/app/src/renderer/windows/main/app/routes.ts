import type { Component } from 'solid-js'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'
import type { NavigationPage } from '../domain-ui/navigation/list'

export interface PageRoute extends NavigationPage {
  target: NativeViewTarget
  accepts: (target: NativeViewTarget) => boolean
  view: Component<{ api: MainClient; target: NativeViewTarget }>
}

export const pages: readonly PageRoute[] = []
