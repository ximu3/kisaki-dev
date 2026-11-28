import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { parseEntryRule, type EntryRule } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { errorMessage } from '../../../../../../infrastructure/notifications'
import { Choice } from './controls'
import { Operands } from './operands'
import { PartScope, Qualifiers } from './qualifiers'
import {
  operators,
  applicable,
  newCondition,
  newBody,
  object,
  parsedFilter,
  relationTargets,
  type Draft,
  type Field,
  type Op,
} from './model'

export function EntryFilterDialog(props: {
  api: MainClient
  rule: EntryRule
  apply: (v: EntryRule['filter']) => void
  close: () => void
}) {
  const { api, rule } = props,
    t = api.t
  const [match, setMatch] = createSignal(rule.filter.match),
    [rows, setRows] = createSignal<readonly Draft[]>(rule.filter.conditions.map((c) => ({ ...c }))),
    [error, setError] = createSignal<unknown>()
  const fields = (Object.keys(operators) as Field[]).filter((key) => applicable(key, rule.types))
  const update = (i: number, value: Draft) =>
    setRows((before) => before.map((r, n) => (n === i ? value : r)))
  function submit() {
    try {
      const filter = parsedFilter(match(), rows())
      parseEntryRule({ ...rule, filter })
      props.apply(filter)
      props.close()
    } catch (cause) {
      setError(() => cause)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) {
          props.close()
        }
      }}
    >
      <DialogContent size="md">
        <DialogHeader closeLabel={t('actions.close')}>
          <DialogTitle>{t('library.browse.filter')}</DialogTitle>
        </DialogHeader>
        <DialogBody class="space-y-3">
          <Choice
            t={t}
            label={t('library.criteria.match')}
            values={['all', 'any'] as const}
            value={match()}
            name={(v) => t(`library.criteria.${v}`)}
            change={setMatch}
          />
          <For each={rows().map((_, i) => i)}>
            {(i) => {
              const row = () => rows()[i]!,
                field = () => row().field as Field,
                relation = () => relationTargets[field()],
                body = () => (relation() ? object(row().targets) : row()),
                op = () => (field() === 'completions' ? row().match : body().op) as Op
              function changeBody(next: Draft) {
                if (relation()) {
                  update(i, { ...row(), targets: next })
                  return
                }
                const { scope, measure } = row()
                update(i, {
                  field: field(),
                  ...next,
                  ...(field() === 'parts' && { scope, measure }),
                })
              }
              return (
                <fieldset class="space-y-3 rounded-md border border-border p-3">
                  <div class="flex items-end gap-2">
                    <div class="grow">
                      <Choice
                        t={t}
                        label={t('library.criteria.field')}
                        values={fields.includes(field()) ? fields : [field(), ...fields]}
                        value={field()}
                        name={(k) => t(`library.queryFields.${k}`)}
                        change={(k) => update(i, newCondition(k, rule.types))}
                      />
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t('actions.remove')}
                      onClick={() => setRows((v) => v.filter((_, n) => n !== i))}
                    >
                      <Icon path={mdiTrashCanOutline} />
                    </Button>
                  </div>
                  <Choice
                    t={t}
                    label={t('library.criteria.op')}
                    values={operators[field()]}
                    value={op()}
                    name={(v) => t(`library.criteria.${v}`)}
                    change={(v) => changeBody(newBody(v))}
                  />
                  <Show when={field() === 'parts'}>
                    <PartScope
                      api={api}
                      types={rule.types}
                      scope={object(row().scope)}
                      measure={row().measure as string}
                      change={(scope, measure) => update(i, { ...row(), scope, measure })}
                    />
                  </Show>
                  <Operands
                    api={api}
                    field={field()}
                    body={body()}
                    op={op()}
                    targets={relation()}
                    change={changeBody}
                  />
                  <Show when={relation() || field() === 'completions'}>
                    <Qualifiers
                      api={api}
                      field={field()}
                      where={object(row().where)}
                      change={(where) => update(i, { ...row(), where })}
                    />
                  </Show>
                </fieldset>
              )
            }}
          </For>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRows((before) => [...before, newCondition('favorite', rule.types)])}
          >
            <Icon path={mdiPlus} />
            {t('library.criteria.add')}
          </Button>
        </DialogBody>
        <DialogFooter>
          <Show when={error()}>
            {(e) => (
              <span role="alert" class="me-auto text-sm text-destructive">
                {errorMessage(e())}
              </span>
            )}
          </Show>
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={submit}>{t('actions.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
