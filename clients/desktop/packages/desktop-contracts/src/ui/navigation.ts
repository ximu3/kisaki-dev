/** @fileoverview Defines concrete navigation targets for native views and application search. */
import type { ThemeRef } from '../appearance'
import type { DeeplinkViewTarget } from '../deeplink'
import type { AnnotationRef } from '../library/annotations'
import type { EntryRef, PartRef, WorkRef } from '../library/identity'
import type { PreferenceKey } from '../preferences'
import type { PageRef } from './pages'

/** Concrete existing objects that can be opened directly from application search. */
export type SearchTarget =
  | { readonly type: 'entry'; readonly ref: EntryRef }
  | { readonly type: 'part'; readonly work: WorkRef; readonly ref: PartRef }
  | { readonly type: 'collection'; readonly id: string }
  | { readonly type: 'tag'; readonly id: string }
  | { readonly type: 'note'; readonly id: string }
  | { readonly type: 'annotation'; readonly ref: AnnotationRef }
  | { readonly type: 'metadataProfile'; readonly id: string }
  | { readonly type: 'scanConfig'; readonly id: string }
  | { readonly type: 'font'; readonly id: string }
  | { readonly type: 'extension'; readonly id: string }
  | { readonly type: 'launchConfig'; readonly gameId: string; readonly id: string }
  | { readonly type: 'theme'; readonly ref: ThemeRef }
  | { readonly type: 'page'; readonly ref: PageRef }
  | { readonly type: 'preference'; readonly key: PreferenceKey }

/** Native routes include current-library objects and management entry points; only the declared deeplink subset has public URLs. */
export type NativeViewTarget =
  | DeeplinkViewTarget
  | SearchTarget
  | { readonly type: 'sessions.recordings'; readonly sessionId?: string }
  | { readonly type: 'themes' | 'fonts' | 'systemIntegrations' | 'updates' | 'onboarding' }
