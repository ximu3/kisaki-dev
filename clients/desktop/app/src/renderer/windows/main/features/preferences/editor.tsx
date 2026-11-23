import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
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

const sections = [
  'general',
  'appearance',
  'navigation',
  'library',
  'usage',
  'shortcuts',
  'network',
  'updates',
] as const

type Section = (typeof sections)[number]

interface PreferenceEditorProps {
  api: MainClient
  pages: readonly NavigationPage[]
  field?: PreferenceKey | undefined
  registerEditor: (guard: EditorGuard) => () => void
  openResource: (type: 'themes' | 'fonts') => void
}

export function PreferenceEditor(props: PreferenceEditorProps) {
  const { api } = props
  const draft = createPreferenceDraft(api)
  deferDialogUntil(() => !!draft.ready() || !!draft.error())

  const [section, setSection] = createSignal<Section>('general')
  const [showProxyDetails, setShowProxyDetails] = createSignal(false)
  let tabList!: HTMLDivElement
  let fieldsViewport!: HTMLDivElement
  let fieldToReveal: string | undefined

  const [stagedEdit, setStagedEdit] = createSignal<StagedPreferenceEdit>()
  let stagedForm: FormState | undefined

  function editUsage(medium: UsageMedium, field?: string) {
    fieldsViewport.querySelector<HTMLElement>(`[data-usage-medium="${medium}"]`)?.focus()
    const keys = preferenceKeys.filter((key) => key.startsWith(`usage.${medium}.`))
    const stage = draft.stage(keys)
    setStagedEdit({
      draft: stage,
      field,
      size: medium === 'game' ? 'md' : 'lg',
      title: () => api.t(`runtime.usageTitles.${medium}`),
      fields: () => (
        <UsageEditorFields
          api={api}
          medium={medium}
          draft={stage}
          manageFonts={() => props.openResource('fonts')}
        />
      ),
    })
  }

  function editProxyCredentials() {
    focusPreferenceField(fieldsViewport, proxyCredentialsKey)
    const stage = draft.stage([proxyCredentialsKey])
    setStagedEdit({
      draft: stage,
      size: 'sm',
      title: () => api.t('runtime.fields.credentials'),
      fields: () => <ProxyCredentialFields t={api.t} draft={stage} />,
    })
  }

  function bindStagedForm(form: FormState) {
    stagedForm = form
    onCleanup(() => {
      if (stagedForm === form) {
        stagedForm = undefined
      }
    })
  }

  function selectSection(next: Section) {
    fieldToReveal = undefined
    setSection(next)
    setShowProxyDetails(false)
    fieldsViewport.scrollTop = 0
  }

  function revealField(key: string) {
    const next = sections.find((candidate) => key.startsWith(`${candidate}.`))
    if (!next) {
      return
    }
    fieldToReveal = key
    setSection(next)
    setShowProxyDetails(next === 'network' && key !== 'network.mode')

    queueMicrotask(() => {
      if (fieldToReveal !== key) {
        return
      }
      fieldToReveal = undefined
      tabList
        .querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })

      const medium = usageMedia.find((value) => key.startsWith(`usage.${value}.`))
      if (medium) {
        editUsage(medium, key)
      } else {
        focusPreferenceField(fieldsViewport, key)
      }
    })
  }

  let lastRequestedField: PreferenceKey | undefined
  createEffect(
    () => [props.field, draft.ready()],
    ([key, ready]) => {
      if (key && key !== lastRequestedField && ready) {
        revealField(key)
      }
      lastRequestedField = ready ? key : undefined
    },
  )

  const form = createForm({
    order: () => preferenceKeys,
    locate: revealField,
    validate: draft.validate,
    onSubmit: draft.save,
  })

  async function confirmStagedEdit() {
    return (await stagedForm?.submit()) ?? false
  }

  async function saveBeforeLeaving() {
    if (!form.busy() && stagedEdit() && !(await confirmStagedEdit())) {
      return false
    }
    return form.submit()
  }

  const unregisterEditor = props.registerEditor({
    busy: form.busy,
    dirty: () => draft.dirty() || !!stagedEdit()?.draft.dirty(),
    save: saveBeforeLeaving,
    currentFormAction: () => (stagedEdit() ? confirmStagedEdit : undefined),
  })
  onCleanup(() => {
    fieldToReveal = undefined
    unregisterEditor()
  })

  const fields: Record<Section, () => JSX.Element> = {
    general: () => <GeneralFields api={api} draft={draft} />,
    appearance: () => (
      <AppearanceFields api={api} draft={draft} manage={() => props.openResource('themes')} />
    ),
    navigation: () => <NavigationFields api={api} draft={draft} pages={props.pages} />,
    library: () => <LibraryFields api={api} draft={draft} />,
    usage: () => <UsageFields t={api.t} draft={draft} open={editUsage} />,
    shortcuts: () => <ShortcutFields draft={draft} t={api.t} platform={api.platform} />,
    network: () => (
      <NetworkFields
        api={api}
        draft={draft}
        forceDetails={showProxyDetails()}
        clearDetails={() => setShowProxyDetails(false)}
        configureCredentials={editProxyCredentials}
      />
    ),
    updates: () => <UpdateFields api={api} draft={draft} />,
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('runtime.preferences')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="flex min-h-0 flex-col overflow-hidden p-0">
          <Tabs
            value={section()}
            onValueChange={(value) => selectSection(value as Section)}
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
                  <For each={sections}>
                    {(value) => <Tab value={value}>{api.t(`runtime.fields.${value}`)}</Tab>}
                  </For>
                </TabList>
              </ToolbarRow>
            </Toolbar>

            <ScrollArea
              ref={(node) => {
                fieldsViewport = node
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
                  <For each={sections}>
                    {(name) => (
                      <TabPanel value={name} class="p-4">
                        <Show when={name === 'network' || section() === name}>
                          {fields[name]()}
                        </Show>
                      </TabPanel>
                    )}
                  </For>
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
        edit={stagedEdit()}
        bind={bindStagedForm}
        close={() => setStagedEdit(undefined)}
      />
    </>
  )
}
