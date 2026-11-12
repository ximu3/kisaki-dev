/** @fileoverview Checks consumer-visible correlations and forbidden combinations; the functions are never executed. */

import type { PartialDate } from '@kisaki3/desktop-contracts/date'
import type {
  LibraryApi,
  EntryCreate,
  ShowcaseApi,
  ShowcaseFields,
  ShowcaseSection,
} from '@kisaki3/desktop-contracts/library'
import type { MetadataReadRequest } from '@kisaki3/desktop-contracts/metadata'
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
import type { OnboardingApplyInput } from '@kisaki3/desktop-contracts/onboarding'
import type { AppApi } from '@kisaki3/desktop-contracts/app'
import type { PrivateStorageApi } from '@kisaki3/desktop-contracts/private-data'
import type { ViewClientIpc } from '@kisaki3/desktop-contracts/ui'

/** Consumer method catalog exercising void and required private-call inputs. */
interface ExampleViewMethods {
  readonly read: { readonly input: void; readonly result: string }
  readonly save: { readonly input: { readonly value: string }; readonly result: void }
}

/** Consumer notification catalog exercising a typed change payload. */
interface ExampleViewNotifications {
  readonly changed: { readonly value: string }
}

/**
 * Checks saved section results and explicit creation inputs against the shared showcase and
 * onboarding types.
 */
export async function checkShowcase(showcase: ShowcaseApi, initial: ShowcaseFields): Promise<void> {
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

  void section
  void batch
  void apply
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
  void state
  void apply
}
