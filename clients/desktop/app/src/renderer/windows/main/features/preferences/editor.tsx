/** @fileoverview Hosts the complete preference draft and its responsive, independently scrollable sections. */

import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { preferenceKeys, type PreferenceKey } from '@kisaki3/desktop-contracts/preferences'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { createForm, Form, FormFeedback, type FormState } from '@kisaki3/desktop-ui/form'
import { ScrollArea } from '@kisaki3/desktop-ui/scroll-area'
import { Toolbar, ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { MainClient } from '../../../../infrastructure/api'
import type { EditorGuard } from '../../../../infrastructure/dialogs/closing'
import type { NavigationPage } from '../../domain-ui/navigation/list'
import { createPreferenceDraft } from './draft'
import { focusPreferenceField, PreferenceFieldsContext } from './field'
import { NetworkFields, ProxyCredentialFields, proxyCredentialsKey } from './network'
import {
  GeneralFields,
  AppearanceFields,
  NavigationFields,
  LibraryFields,
  UpdateFields,
} from './groups'
import { ShortcutFields } from './shortcuts'
import { StagedPreferenceDialog, type StagedPreferenceEdit } from './staged-dialog'
import { UsageEditorFields } from './usage/editor'
import { UsageFields, usageMedia, type UsageMedium } from './usage/fields'

/** Display order for the preference draft's independently navigable sections. */
const groups = [
  'general',
  'appearance',
  'navigation',
  'library',
  'usage',
  'shortcuts',
  'network',
  'updates',
] as const

/** Accessible group identity used by the top tab list. */
type Group = (typeof groups)[number]

/** Identifies the preference branch whose staged form currently owns editing. */
type ChildEdit = StagedPreferenceEdit &
  ({ kind: 'usage'; medium: UsageMedium } | { kind: 'proxy-credentials' })

/** Extends the leave decision with the navigation and save scope of a staged preference form. */
export interface PreferenceEditorGuard extends EditorGuard {
  stagedForm: () => FormState | undefined
}

/** Owns one preference draft and reveals fields before native navigation or validation focuses them. */
export function PreferenceEditor(props: {
  api: MainClient
  pages: readonly NavigationPage[]
  field?: PreferenceKey | undefined
  bind: (guard: PreferenceEditorGuard) => () => void
  manage: (page: 'themes' | 'fonts') => void
}) {
  const { api } = props
  const draft = createPreferenceDraft(api)
  deferDialogUntil(() => !!draft.ready() || !!draft.error())
  const [group, setGroup] = createSignal<Group>('general')
  const [revealingProxy, setRevealProxy] = createSignal(false)
  let panel!: HTMLDivElement
  let tabList!: HTMLDivElement

  const [childEdit, setChildEdit] = createSignal<ChildEdit>()
  let childForm: FormState | undefined

  function openUsage(medium: UsageMedium, field?: string) {
    panel.querySelector<HTMLElement>(`[data-usage-medium="${medium}"]`)?.focus()
    const keys = preferenceKeys.filter((key) => key.startsWith(`usage.${medium}.`))
    setChildEdit({ kind: 'usage', medium, draft: draft.stage(keys), field })
  }

  function openCredentials() {
    focusPreferenceField(panel, proxyCredentialsKey)
    setChildEdit({ kind: 'proxy-credentials', draft: draft.stage([proxyCredentialsKey]) })
  }

  function bindChildForm(form: FormState) {
    childForm = form
    onCleanup(() => {
      if (childForm === form) {
        childForm = undefined
      }
    })
  }

  function locate(key: string) {
    const next = groups.find((section) => key.startsWith(section + '.'))
    if (!next) {
      return
    }

    const medium = usageMedia.find((value) => key.startsWith(`usage.${value}.`))
    setGroup(next)
    setRevealProxy(next === 'network' && key !== 'network.mode')

    queueMicrotask(() => {
      tabList
        .querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      if (medium) {
        openUsage(medium, key)
      } else {
        focusPreferenceField(panel, key)
      }
    })
  }

  const form = createForm({
    validate: draft.validate,
    locate,
    order: () => preferenceKeys,
    onSubmit: draft.save,
  })

  async function save() {
    if (!form.busy() && childEdit() && !(await childForm?.submit())) {
      return false
    }
    return form.submit()
  }
  onCleanup(
    props.bind({
      busy: form.busy,
      dirty: () => draft.dirty() || !!childEdit()?.draft.dirty(),
      save,
      stagedForm: () => (childEdit() ? childForm : undefined),
    }),
  )

  let focused: PreferenceKey | undefined
  createEffect(
    () => [props.field, draft.ready()],
    ([key, ready]) => {
      if (key && key !== focused && ready) {
        locate(key)
      }
      focused = ready ? key : undefined
    },
  )

  function selectGroup(next: Group) {
    setGroup(next)
    setRevealProxy(false)
    panel.scrollTop = 0
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('runtime.preferences')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="flex min-h-0 flex-col overflow-hidden p-0">
          <Tabs
            value={group()}
            onValueChange={(value) => selectGroup(value as Group)}
            class="flex min-h-0 grow flex-col"
          >
            <Toolbar band>
              <ToolbarRow>
                <TabList
                  ref={(node) => {
                    tabList = node
                  }}
                  aria-label={api.t('runtime.section')}
                >
                  <For each={groups}>
                    {(value) => <Tab value={value}>{api.t(`runtime.fields.${value}`)}</Tab>}
                  </For>
                </TabList>
              </ToolbarRow>
            </Toolbar>

            <ScrollArea
              ref={(node) => {
                panel = node
              }}
              orientation="vertical"
              class="min-w-0 grow"
            >
              <Show when={draft.error()}>
                {(cause) => (
                  <Alert tone="destructive" role="alert" class="m-4">
                    {errorMessage(cause())}{' '}
                    <Button variant="outline" onClick={draft.retry}>
                      {api.t('runtime.retry')}
                    </Button>
                  </Alert>
                )}
              </Show>
              <Show
                when={draft.ready()}
                fallback={!draft.error() && <Spinner label={api.t('runtime.loading')} />}
              >
                <PreferenceFieldsContext value={{ draft, t: api.t }}>
                  <TabPanel value="general" class="p-4">
                    <Show when={group() === 'general'}>
                      <GeneralFields api={api} draft={draft} />
                    </Show>
                  </TabPanel>
                  <TabPanel value="appearance" class="p-4">
                    <Show when={group() === 'appearance'}>
                      <AppearanceFields
                        api={api}
                        draft={draft}
                        manage={() => props.manage('themes')}
                      />
                    </Show>
                  </TabPanel>
                  <TabPanel value="navigation" class="p-4">
                    <Show when={group() === 'navigation'}>
                      <NavigationFields api={api} draft={draft} pages={props.pages} />
                    </Show>
                  </TabPanel>
                  <TabPanel value="library" class="p-4">
                    <Show when={group() === 'library'}>
                      <LibraryFields api={api} draft={draft} />
                    </Show>
                  </TabPanel>
                  <TabPanel value="usage" class="p-4">
                    <Show when={group() === 'usage'}>
                      <UsageFields t={api.t} draft={draft} open={openUsage} />
                    </Show>
                  </TabPanel>
                  <TabPanel value="shortcuts" class="p-4">
                    <Show when={group() === 'shortcuts'}>
                      <ShortcutFields draft={draft} t={api.t} platform={api.platform} />
                    </Show>
                  </TabPanel>
                  <TabPanel value="network" class="p-4">
                    <NetworkFields
                      api={api}
                      draft={draft}
                      forceDetails={revealingProxy()}
                      clearDetails={() => setRevealProxy(false)}
                      configureCredentials={openCredentials}
                    />
                  </TabPanel>
                  <TabPanel value="updates" class="p-4">
                    <Show when={group() === 'updates'}>
                      <UpdateFields api={api} draft={draft} />
                    </Show>
                  </TabPanel>
                </PreferenceFieldsContext>
              </Show>
            </ScrollArea>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <FormFeedback summary={(count) => api.t('runtime.fieldErrors', { count })} />
          <Button type="submit" disabled={!draft.dirty() || form.busy()}>
            {api.t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>

      <StagedPreferenceDialog
        t={api.t}
        edit={childEdit()}
        bind={bindChildForm}
        close={() => setChildEdit(undefined)}
        title={(edit) =>
          edit.kind === 'usage'
            ? api.t(`runtime.usageTitles.${edit.medium}`)
            : api.t('runtime.fields.credentials')
        }
        size={(edit) => {
          if (edit.kind === 'proxy-credentials') {
            return 'sm'
          }
          return edit.medium === 'game' ? 'md' : 'lg'
        }}
        fields={(edit) =>
          edit.kind === 'usage' ? (
            <UsageEditorFields
              api={api}
              medium={edit.medium}
              draft={edit.draft}
              manageFonts={() => props.manage('fonts')}
            />
          ) : (
            <ProxyCredentialFields t={api.t} draft={edit.draft} />
          )
        }
      />
    </>
  )
}
