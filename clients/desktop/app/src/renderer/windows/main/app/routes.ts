/** @fileoverview Describes native page entry points and the main window's existing management surfaces. */

import type { Component } from 'solid-js'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import type { MainClient } from '../../../infrastructure/api'

/** Management destinations displayed above the currently mounted page. */
export type ManagementTarget =
  | Extract<NativeViewTarget, { type: 'tasks' | 'preferences' | 'fonts' | 'themes' }>
  | { type: 'systemIntegration' | 'about' }

/** A native business page and the navigation targets it can present. */
export interface PageRoute {
  id: string
  title: (api: MainClient) => string
  icon: Component
  target: NativeViewTarget
  accepts: (target: NativeViewTarget) => boolean
  view: Component<{ api: MainClient; target: NativeViewTarget }>
}

/** Pages are registered by their feature work packages; management surfaces use dialogs. */
export const pages: readonly PageRoute[] = []

/** Selects destinations already owned by the main window's management tools. */
export function managementTarget(target: NativeViewTarget): ManagementTarget | undefined {
  if (
    target.type === 'tasks' ||
    target.type === 'preferences' ||
    target.type === 'fonts' ||
    target.type === 'themes'
  ) {
    return target
  }
  if (target.type === 'systemIntegration' || target.type === 'about') {
    return { type: target.type }
  }
  return undefined
}
