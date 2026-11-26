import {
  createEffect,
  createSignal,
  For,
  lazy,
  onCleanup,
  onSettled,
  Show,
  useContext,
} from 'solid-js'
import type { JSX } from '@solidjs/web'
import { preferenceKeys, type PreferenceKey } from '@kisaki3/desktop-contracts/preferences'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
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
import type { MainClient } from '../../../../infrastructure/api'
import { waitForDecision } from '../../../../infrastructure/dialogs/closing'
import { WindowEditors } from '../../../../infrastructure/dialogs/editors'
import { createLocalDialog, useDialogClose } from '../../../../infrastructure/dialogs/presentation'
import type { NavigableDialog } from '../../infrastructure/navigation'
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
import {
  StagedPreferenceDialog,
  StagedPreferenceForm,
  type StagedPreferenceEdit,
} from './staged-dialog'
import { UsageEditorFields } from './usage/editor'
import { UsageFields, usageMedia, type UsageMedium } from './usage/fields'
import { QueryError } from '../../../../infrastructure/query/error'

const Themes = lazy(() => import('../themes/manager'), { export: 'Themes' })
const Fonts = lazy(() => import('../fonts/manager'), { export: 'Fonts' })

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
  view: NavigableDialog
}

export function PreferenceEditor(props: PreferenceEditorProps) {
  const close = useDialogClose(props.view)
  const [visible, setVisible] = createSignal(false)

  return (
    <Dialog open={props.view.open()} onOpenChange={close.onOpenChange}>
      <DialogContent
        ref={close.ref}
        size="xl"
        fill
        onCloseRequest={close.onCloseRequest}
        onToggle={(event) => setVisible(event.currentTarget.open)}
      >
        <PreferenceForm {...props} visible={visible()} dialog={close.node} />
      </DialogContent>
    </Dialog>
  )
}

interface FieldRequest {
  key: PreferenceKey | undefined
  complete: (found: boolean) => void
  failed: (error: unknown) => void
  signal?: AbortSignal
}

function PreferenceForm(
  props: PreferenceEditorProps & {
    visible: boolean
    dialog: () => HTMLDialogElement
  },
) {
  const { api } = props
  const editors = useContext(WindowEditors)!
  const draft = createPreferenceDraft(api)
  deferDialogUntil(() => !!draft.ready() || !!draft.error())

  const [section, setSection] = createSignal<Section>('general')
  const [showProxyDetails, setShowProxyDetails] = createSignal(false)
  let tabList!: HTMLDivElement
  let fieldsViewport!: HTMLDivElement
  let fieldToReveal: string | undefined
  let credentialsDialog: HTMLDialogElement | undefined
  const themes = createLocalDialog(Themes.preload, props.view.open)
  const fonts = createLocalDialog(Fonts.preload, props.view.open)

  const [stagedEdit, setStagedEdit] = createSignal<
    StagedPreferenceEdit & { medium?: UsageMedium }
  >()
  const inlineEdit = () => {
    const edit = stagedEdit()
    return edit?.medium ? edit : undefined
  }
  let stagedForm: FormState | undefined
  let usageScrollTop = 0

  function editUsage(medium: UsageMedium, field?: string, located?: (found: boolean) => void) {
    usageScrollTop = fieldsViewport.scrollTop
    const keys = preferenceKeys.filter((key) => key.startsWith(`usage.${medium}.`))
    const stage = draft.stage(keys)
    setStagedEdit({
      draft: stage,
      field,
      located,
      medium,
      title: () => api.t(`runtime.usageTitles.${medium}`),
      fields: () => <UsageEditorFields api={api} medium={medium} manageFonts={fonts.show} />,
    })
  }

  function editProxyCredentials() {
    focusPreferenceField(fieldsViewport, proxyCredentialsKey)
    const stage = draft.stage([proxyCredentialsKey])
    setStagedEdit({
      draft: stage,
      title: () => api.t('runtime.fields.credentials'),
      fields: () => <ProxyCredentialFields />,
    })
  }

  function closeStagedEdit() {
    const medium = inlineEdit()?.medium
    setStagedEdit(undefined)
    if (medium) {
      onSettled(() => {
        if (section() !== 'usage' || stagedEdit() || !fieldsViewport.isConnected) {
          return
        }
        fieldsViewport.scrollTop = usageScrollTop
        fieldsViewport
          .querySelector<HTMLElement>(`[data-usage-medium="${medium}"]`)
          ?.focus({ preventScroll: true })
      })
    }
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

  function revealField(key: string, located?: (found: boolean) => void, signal?: AbortSignal) {
    const next = sections.find((candidate) => key.startsWith(`${candidate}.`))
    if (!next) {
      located?.(false)
      return
    }
    fieldToReveal = key
    setSection(next)
    setShowProxyDetails(next === 'network' && key !== 'network.mode')

    onSettled(() => {
      if (fieldToReveal !== key) {
        return
      }
      fieldToReveal = undefined
      if (signal?.aborted) {
        return
      }
      tabList
        .querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })

      const medium = usageMedia.find((value) => key.startsWith(`usage.${value}.`))
      if (medium) {
        editUsage(medium, key, located)
      } else {
        const found = focusPreferenceField(fieldsViewport, key)
        located?.(found)
      }
    })
  }

  const [requested, setRequested] = createSignal<FieldRequest | undefined>({
    key: props.field,
    complete(found) {
      if (found) {
        props.view.receipt.presented()
      } else {
        props.view.receipt.failed(new DesktopError('NotFound', api.t('runtime.unavailable')))
      }
    },
    failed: props.view.receipt.failed,
  })
  createEffect(
    () => [requested(), props.visible, draft.ready(), draft.error()] as const,
    ([request, visible, ready, error]) => {
      if (!visible || !request || request.signal?.aborted) {
        return
      }
      if (!request.key) {
        request.complete(true)
      } else if (ready) {
        revealField(request.key, request.complete, request.signal)
      } else if (error) {
        request.failed(error)
      } else {
        return
      }
      setRequested(undefined)
    },
  )
  props.view.onNavigate(async (target, signal) => {
    if (target.type !== 'preferences' || stagedEdit() || themes.view.open() || fonts.view.open()) {
      return false
    }
    const positioned = Promise.withResolvers<boolean>()
    setRequested({
      key: target.key,
      complete(found) {
        if (found) {
          positioned.resolve(true)
        } else {
          positioned.reject(new DesktopError('NotFound', api.t('runtime.unavailable')))
        }
      },
      failed: positioned.reject,
      signal,
    })
    return waitForDecision(positioned.promise, signal)
  })

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

  onSettled(() => {
    const unregisterEditor = editors.register(
      {
        busy: form.busy,
        dirty: () => draft.dirty() || !!stagedEdit()?.draft.dirty(),
        save: saveBeforeLeaving,
        currentFormAction: () => (stagedEdit() ? confirmStagedEdit : undefined),
      },
      props.dialog,
      () => !!credentialsDialog && credentialsDialog === document.activeElement?.closest('dialog'),
    )
    return () => {
      fieldToReveal = undefined
      unregisterEditor()
    }
  })

  const fields: Record<Section, () => JSX.Element> = {
    general: () => <GeneralFields api={api} />,
    appearance: () => <AppearanceFields api={api} manage={themes.show} />,
    navigation: () => <NavigationFields pages={props.pages} />,
    library: () => <LibraryFields />,
    usage: () => <UsageFields open={editUsage} />,
    shortcuts: () => <ShortcutFields platform={api.platform} />,
    network: () => (
      <NetworkFields
        api={api}
        forceDetails={showProxyDetails()}
        clearDetails={() => setShowProxyDetails(false)}
        configureCredentials={editProxyCredentials}
      />
    ),
    updates: () => <UpdateFields />,
  }

  return (
    <>
      <Show when={!inlineEdit()}>
        <DialogHeader closeLabel={api.t('actions.close')}>
          <DialogTitle>{api.t('runtime.preferences')}</DialogTitle>
        </DialogHeader>
      </Show>
      <Form state={form} style={{ display: inlineEdit() ? 'none' : undefined }}>
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
              <QueryError
                error={draft.error()}
                retryLabel={api.t('runtime.retry')}
                retry={draft.retry}
                class="m-4"
              />
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

      <Show when={inlineEdit()} keyed>
        {(edit) => (
          <StagedPreferenceForm
            inline
            t={api.t}
            edit={edit}
            bind={bindStagedForm}
            close={closeStagedEdit}
          />
        )}
      </Show>

      <StagedPreferenceDialog
        t={api.t}
        dialogRef={(node) => {
          credentialsDialog = node
        }}
        edit={inlineEdit() ? undefined : stagedEdit()}
        bind={bindStagedForm}
        close={closeStagedEdit}
      />
      <Show when={themes.mounted()}>
        <Themes api={api} view={themes.view} />
      </Show>
      <Show when={fonts.mounted()}>
        <Fonts api={api} view={fonts.view} />
      </Show>
    </>
  )
}
