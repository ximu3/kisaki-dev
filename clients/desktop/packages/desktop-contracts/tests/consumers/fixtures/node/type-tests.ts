/** @fileoverview Checks consumer-visible correlations and forbidden combinations; the functions are never executed. */

import type { PartialDate } from '@kisaki3/desktop-contracts/date'
import type {
  LibraryApi,
  EntryCreate,
  ShowcaseApi,
  ShowcaseFields,
  ShowcaseSection,
  EntryRef,
  PartRef,
} from '@kisaki3/desktop-contracts/library'
import type {
  MetadataReadRequest,
  MetadataProfilesApi,
  MetadataProfile,
} from '@kisaki3/desktop-contracts/metadata'
import { parseFieldProcessingResult } from '@kisaki3/desktop-contracts/metadata'
import type { ThemesApi, UserThemeCreate } from '@kisaki3/desktop-contracts/appearance'
import type { IngestApi, IngestUpdateInput } from '@kisaki3/desktop-contracts/ingest'
import type {
  AnimePlaybackPreferences,
  PlaybackOverrideChange,
} from '@kisaki3/desktop-contracts/preferences'
import type { ViewResourcesApi, ReadResourceRef } from '@kisaki3/desktop-contracts/resources'
import type {
  AnimeSessionsApi,
  GameSessionsApi,
  SavedPlaybackSetting,
} from '@kisaki3/desktop-contracts/sessions'
import type { ExecutionContext } from '@kisaki3/desktop-contracts/operations'
import type { SearchResult } from '@kisaki3/desktop-contracts/search'
import type { DeeplinkOpenTarget } from '@kisaki3/desktop-contracts/deeplink'
import type { NetworkApi, NetworkFetchOptions } from '@kisaki3/desktop-contracts/network'
import type { EventsApi } from '@kisaki3/desktop-contracts/events'
import type { ApplicationUpdateState } from '@kisaki3/desktop-contracts/updates'
import type { OnboardingApi, OnboardingApplyInput } from '@kisaki3/desktop-contracts/onboarding'
import type { AppApi } from '@kisaki3/desktop-contracts/app'
import type { PrivateStorageApi } from '@kisaki3/desktop-contracts/private-data'
import type { ExtensionUiIcon, ViewClientIpc } from '@kisaki3/desktop-contracts/ui'

/** Consumer method catalog exercising void and required private-call inputs. */
interface ExampleViewMethods {
  readonly read: { readonly input: void; readonly result: string }
  readonly save: { readonly input: { readonly value: string }; readonly result: void }
}

/** Consumer notification catalog exercising a typed change payload. */
interface ExampleViewNotifications {
  readonly changed: { readonly value: string }
}

/** Checks that typed reads provide the editable values required by their matching write APIs. */
export async function checkReadEditing(themes: ThemesApi, library: LibraryApi): Promise<void> {
  const theme = await themes.get({ type: 'user', id: 'theme' })
  if (theme) {
    const draft: UserThemeCreate = { name: theme.name, light: theme.light, dark: theme.dark }
    await themes.update(theme.ref.id, { changes: draft, expected: draft })
  }
  const read = await themes.open({ type: 'user', id: 'theme' })
  const light: UserThemeCreate['light'] = read.theme.light
  void light
  await read.dispose()

  const part = await library.parts.get({ type: 'novelVolume', id: 'volume' })
  if (part) {
    await library.parts.update(part.ref, { changes: part.data, expected: part.data })
  }

  const annotation = await library.annotations.get({ workType: 'anime', id: 'annotation' })
  if (annotation) {
    const target = {
      fileId: annotation.fileId,
      location: annotation.location,
      imageId: annotation.imageId,
    }
    await library.annotations.update(
      { workType: annotation.workType, id: annotation.id },
      { changes: { target }, expected: { target } },
    )
  }

  const work = { type: 'anime', id: 'anime' } as const
  const activity = await library.activities.get(work, 'activity')
  if (activity) {
    const timing = {
      startedAt: activity.startedAt,
      endedAt: activity.endedAt,
      durationMs: activity.durationMs,
    }
    await library.activities.update(work, activity.id, {
      changes: timing,
      expected: { activity: { ...timing, context: activity.context } },
    })
  }
}

/** Checks that creation and update results retain their explicitly selected object kinds. */
export async function checkResultKinds(
  library: LibraryApi,
  profiles: MetadataProfilesApi,
  ingest: IngestApi,
  update: IngestUpdateInput<'novel'>,
  playback: PlaybackOverrideChange,
): Promise<void> {
  const volume: PartRef<'novelVolume'> = await library.parts.create({
    type: 'novelVolume',
    work: { type: 'novel', id: 'novel' },
    data: {},
  })
  const merged: PartRef<'novelVolume'> = await library.parts.merge({
    source: volume,
    target: { type: 'novelVolume', id: 'target' },
  })

  for (const preset of await profiles.listPresets({ entryType: 'novel' })) {
    const profile: MetadataProfile<'novel'> = await profiles.create({
      entryType: preset.entryType,
      name: 'Novel profile',
      definition: preset.definition,
    })
    void profile
  }
  // @ts-expect-error: A narrowed result requires an actual runtime kind filter.
  void profiles.listPresets<'novel'>()

  const result = await ingest.update({ type: 'novel', id: 'novel' }, update)
  const target: EntryRef<'novel'> = result.target
  // @ts-expect-error: Typed results must not weaken the correlation between target and input.
  void ingest.update({ type: 'person', id: 'person' }, update)

  const override = await library.holdings.preferences.update(
    { type: 'anime', id: 'anime' },
    { type: 'work' },
    playback,
  )
  const settings: AnimePlaybackPreferences = override.settings
  void merged
  void target
  void settings
}

/** Checks submitted keys and their value types across resource binding and atomic writes. */
export async function checkResultKeys(
  resources: ViewResourcesApi,
  resource: ReadResourceRef,
  library: LibraryApi,
  storage: PrivateStorageApi,
): Promise<void> {
  const binding = await resources.bind({ cover: resource })
  const url: string = binding.urls.cover
  // @ts-expect-error: Unrequested keys are absent from the binding.
  void binding.urls.other
  void url
  await binding.dispose()

  const created = await library.writeGraph({
    entries: { create: [{ key: 'work', type: 'novel', name: 'Novel' }] },
  })
  const work: EntryRef<'novel'> = created.entries.work
  // @ts-expect-error: The graph did not create any parts.
  void created.parts.volume

  const committed = await storage.commit({
    values: [{ type: 'set', key: 'settings', value: { enabled: true } }],
    secrets: [{ type: 'delete', key: 'token' }],
  })
  const revision: string = committed.values.settings
  const removed: null = committed.secrets.token
  void work
  void revision
  void removed
}

/** Checks field-specific values and the distinction between complete and partial keyed results. */
export function checkProcessorKeys(raw: unknown): void {
  const input = {
    items: [
      {
        key: 'flag',
        field: { object: 'entry', entryType: 'novel', field: 'isNsfw' },
        value: false,
      },
    ],
  } as const
  const complete = parseFieldProcessingResult(input, raw)
  const value: boolean = complete.flag
  const partial = parseFieldProcessingResult(input, raw, 'partial')
  const optional: boolean | undefined = partial.flag
  // @ts-expect-error: Parsed results retain the submitted key set.
  void complete.other

  const dynamicItems: readonly (typeof input.items)[number][] = []
  const dynamic = parseFieldProcessingResult({ items: dynamicItems }, raw)
  // @ts-expect-error: A dynamic collection may omit a key allowed by its item type.
  const required: boolean = dynamic.flag
  void value
  void optional
  void required
}

/**
 * Checks saved section results and explicit creation inputs against the shared showcase and
 * onboarding types.
 */
export async function checkShowcase(
  showcase: ShowcaseApi,
  initial: ShowcaseFields,
  onboarding: OnboardingApi,
): Promise<void> {
  const created = await showcase.create(initial)
  const saved = await showcase.update(created.id, {
    changes: { name: 'Updated section' },
    expected: { name: created.name },
  })
  const section: ShowcaseSection | null = await showcase.get(saved.id)
  const batch: readonly ShowcaseSection[] = await showcase.createMany([initial, initial])

  await showcase.reorder({
    order: [saved.id, 'another-section'],
    expected: { order: ['another-section', 'hidden-section', saved.id] },
  })
  await showcase.delete(saved.id)

  const apply: OnboardingApplyInput = {
    group: 'showcase',
    items: [{ itemId: 'collections', expectedHandled: null, input: initial }],
  }
  const result = await onboarding.apply(apply)
  for (const item of result.items) {
    for (const resource of item.resources) {
      const sectionId: string = resource.sectionId
      void sectionId
    }
  }

  void section
  void batch
}

/** Checks named-interface method catalogs, required inputs and notification payload inference. */
export function checkViewIpc(
  typed: ViewClientIpc<ExampleViewMethods, ExampleViewNotifications>,
  dynamic: ViewClientIpc,
): void {
  void typed.invoke('read')
  void typed.invoke('save', { value: 'value' })
  void dynamic.invoke('getSettings')

  typed.on('changed', (payload) => {
    const value: string = payload.value
    void value
  })

  // @ts-expect-error: A method with required business input cannot be called without it.
  void typed.invoke('save')
}

/** Checks accepted API signatures and rejected medium, date and event-payload combinations. */
export function checkContracts(
  library: LibraryApi,
  sessions: AnimeSessionsApi,
  events: EventsApi,
  network: NetworkApi,
  app: AppApi,
  storage: PrivateStorageApi,
): void {
  void library.entries.create({ type: 'game', name: 'Example', record: { status: 'planned' } })
  void library.entries.update({ type: 'person', id: 'person' }, { changes: { name: 'Name' } })

  void sessions.open({ animeId: 'anime', fileId: 'file', position: 'start' })

  const request: NetworkFetchOptions = {
    method: 'POST',
    body: new TextEncoder().encode('data'),
    redirect: 'error',
  }
  void network.fetch(new URL('https://example.test/'), request)

  void app.getEnvironment()

  void storage.commit({
    values: [{ type: 'set', key: 'settings', value: { enabled: true }, expectedRevision: null }],
  })

  events.on('app.ready', (value) => {
    const readyAt: number = value.readyAt
    void readyAt
  })

  // @ts-expect-error: A partial date must retain at least one real component.
  const emptyDate: PartialDate = {}

  const person: EntryCreate<'person'> = {
    type: 'person',
    name: 'Person',
    // @ts-expect-error: A person has no work record.
    record: { status: 'active' },
  }

  const wrongEdit = { changes: { declaredVolumeCount: 1 } }
  // @ts-expect-error: Update fields must match the actual target kind.
  void library.entries.update({ type: 'person', id: 'p' }, wrongEdit)

  // @ts-expect-error: Only game sessions expose force termination.
  void sessions.terminate

  events.on('app.ready', (value) => {
    // @ts-expect-error: The ready event carries readiness, not session context.
    void value.sessionId
  })

  void emptyDate
  void person
}

/**
 * Receives an opening intent to check structural assignability independently of excess-property
 * checks.
 */
export function acceptOpen(target: DeeplinkOpenTarget): void {
  void target
}

/** Checks that per-call interaction options appear only on supported session operations. */
export function checkInteraction(
  game: GameSessionsApi,
  anime: AnimeSessionsApi,
  context: ExecutionContext,
): void {
  void game.open({ gameId: 'g' }, { interaction: 'prompt', signal: context.signal })
  void game.focus('s', { interaction: 'fail' })
  void game.captureImage('s', { interaction: 'prompt' })
  void anime.open({ animeId: 'a' }, { interaction: 'prompt' })

  // @ts-expect-error: A fixed player window does not need an interaction option.
  void anime.focus('s', { interaction: 'prompt' })
  // @ts-expect-error: Execution context carries cancellation; interaction options belong to individual calls.
  void context.allowInteraction
}

/** Receives a committed setting to check its correlated field and persistence scope. */
export function acceptSetting(setting: SavedPlaybackSetting): void {
  void setting
}

/** Receives a novel read request to check root-specific part-slot restrictions. */
export function acceptNovelRead(request: MetadataReadRequest<'novel'>): void {
  void request
}

/** Checks correlated result, intent and native-scope types across consumer entry points. */
export function checkAssociations(): void {
  const icon: ExtensionUiIcon = { type: 'lucide', name: 'book-open' }
  // @ts-expect-error: Built-in names use the fixed catalog rather than component identifiers.
  const invalidIcon: ExtensionUiIcon = { type: 'lucide', name: 'BookOpen' }

  const missingFile = {
    workType: 'anime',
    identifier: { type: 'local', id: 'a' },
    position: 'start',
  } as const
  // @ts-expect-error: Explicit positions require the explicit actual file.
  acceptOpen(missingFile)

  const wrongSetting = { field: 'subtitleScale', scope: 'application', value: 1 } as const
  // @ts-expect-error: Subtitle scale belongs to the adopted complete configuration.
  acceptSetting(wrongSetting)

  const wrongParts = { objects: { parts: { episode: { fields: [] } } } }
  // @ts-expect-error: A novel request cannot contain anime episodes.
  acceptNovelRead(wrongParts)

  const result: SearchResult<'notes'> = {
    total: 1,
    items: [
      {
        // @ts-expect-error: A notes search cannot return an entry target.
        target: { type: 'entry', ref: { type: 'game', id: 'g' } },
        title: 'Note',
        context: null,
        excerpt: null,
        imageId: null,
        icon: null,
      },
    ],
  }

  const state: ApplicationUpdateState = {
    currentVersion: '1.0.0',
    check: { status: 'notChecked' },
    prepared: null,
    operation: null,
  }

  const apply: OnboardingApplyInput = {
    group: 'preferences',
    items: [
      {
        itemId: 'preferences',
        expectedHandled: null,
        input: {
          changes: { general: { closeMainWindow: 'quit' } },
          expected: { general: { closeMainWindow: 'background' } },
        },
      },
    ],
  }

  void result
  void icon
  void invalidIcon
  void state
  void apply
}
