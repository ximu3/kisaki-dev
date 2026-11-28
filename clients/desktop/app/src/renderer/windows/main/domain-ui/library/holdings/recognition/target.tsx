import type {
  FileNumberOutput,
  FileTargetByType,
  FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { For, Show } from 'solid-js'

export type TargetDraft = {
  kind: 'episode' | 'extra' | 'volume' | 'chapter'
  name?: string
  number?: FileNumberOutput
  episodeType?: 'regular' | 'special' | null
  extraType?: 'opening' | 'ending' | 'promotion' | 'interview' | 'other' | null
  numberBasis?: 'work' | 'volume'
  volume?: { name?: string; number?: { value: string; offset: number } }
}

export function initialTarget(kind: TargetDraft['kind']): FileTargetByType[FileWorkType] {
  const number = { kind: 'single', value: '$<number>', offset: 0 } as const
  switch (kind) {
    case 'episode':
      return { kind, number }
    case 'extra':
      return { kind, name: '$<name>' }
    case 'volume':
      return { kind, number }
    case 'chapter':
      return { kind, numberBasis: 'work', number }
  }
}

export function TargetEditor(props: {
  t: Translate
  type: FileWorkType
  target: TargetDraft
  update: (v: TargetDraft) => void
  remove?: (() => void) | undefined
}) {
  const { t } = props
  const options = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  const update = (fields: { [K in keyof TargetDraft]?: TargetDraft[K] | undefined }) => {
    const target = { ...props.target }
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) {
        Reflect.deleteProperty(target, key)
      } else {
        Reflect.set(target, key, value)
      }
    }
    props.update(target)
  }
  const kinds = (
    { anime: ['episode', 'extra'], comic: ['volume', 'chapter'], novel: ['volume'] } as const
  )[props.type]
  const subtypes = () =>
    props.target.kind === 'episode'
      ? (['regular', 'special'] as const)
      : (['opening', 'ending', 'promotion', 'interview', 'other'] as const)
  function changeSubtype(key: string | null) {
    const value = key === 'any' ? undefined : key
    if (props.target.kind === 'episode') {
      update({ episodeType: value as TargetDraft['episodeType'] })
    } else {
      update({ extraType: value as TargetDraft['extraType'] })
    }
  }
  function number(value: FileNumberOutput | undefined) {
    const chapter = props.target.kind === 'chapter'
    update({
      number: value,
      ...(chapter && { numberBasis: value ? (props.target.numberBasis ?? 'work') : undefined }),
    })
  }
  return (
    <div class="space-y-2 border-s-2 ps-3">
      <div class="flex items-end gap-2">
        <Field class="grow">
          <FieldLabel>{t('library.ruleEditor.kind')}</FieldLabel>
          <Select
            {...options}
            options={kinds.map((value) => ({ value, label: t(`library.ruleEditor.${value}`) }))}
            value={props.target.kind}
            onValueChange={(v) => {
              const kind = kinds.find((k) => k === v)
              if (kind) {
                props.update(initialTarget(kind))
              }
            }}
          />
        </Field>
        <Show when={props.remove}>
          {(remove) => (
            <Button size="sm" variant="ghost" onClick={remove()}>
              {t('actions.remove')}
            </Button>
          )}
        </Show>
      </div>
      <Field>
        <FieldLabel>{t('library.fields.name')}</FieldLabel>
        <Input
          value={props.target.name ?? ''}
          onValueChange={(v) => update({ name: v || undefined })}
        />
      </Field>
      <Show when={props.target.kind === 'extra' || props.target.kind === 'episode'}>
        <Field>
          <FieldLabel>{t('library.ruleEditor.subtype')}</FieldLabel>
          <Select
            {...options}
            options={(['any', ...subtypes()] as const).map((key) => ({
              value: key,
              label: t(`library.ruleEditor.${key}`),
            }))}
            value={props.target.episodeType ?? props.target.extraType ?? 'any'}
            onValueChange={changeSubtype}
          />
        </Field>
      </Show>
      <Show when={props.target.kind !== 'extra'}>
        <Field>
          <FieldLabel>{t('library.holdings.number')}</FieldLabel>
          <Select
            {...options}
            options={(['none', 'single', 'range'] as const).map((value) => ({
              value,
              label: t(`library.holdings.${value}`),
            }))}
            value={props.target.number?.kind ?? 'none'}
            onValueChange={(v) => {
              if (v === 'none') {
                number(undefined)
              }
              if (v === 'single') {
                number({ kind: v, value: '', offset: 0 })
              }
              if (v === 'range') {
                number({ kind: v, start: '', end: '', offset: 0 })
              }
            }}
          />
        </Field>
        <Show when={props.target.number}>
          {(n) => (
            <div class="grid grid-cols-2 gap-2">
              <For each={n().kind === 'range' ? (['start', 'end'] as const) : (['value'] as const)}>
                {(key) => (
                  <Field>
                    <FieldLabel>
                      {t(key === 'end' ? 'library.holdings.numberEnd' : 'library.holdings.number')}
                    </FieldLabel>
                    <Input
                      value={Reflect.get(n(), key) as string}
                      onValueChange={(v) => number({ ...n(), [key]: v })}
                    />
                  </Field>
                )}
              </For>
              <Offset t={t} value={n().offset} change={(offset) => number({ ...n(), offset })} />
            </div>
          )}
        </Show>
      </Show>
      <Show when={props.target.kind === 'chapter'}>
        <Show when={props.target.number}>
          <Field>
            <FieldLabel>{t('library.ruleEditor.basis')}</FieldLabel>
            <Select
              {...options}
              value={props.target.numberBasis ?? 'work'}
              options={(['work', 'volume'] as const).map((value) => ({
                value,
                label: t(`library.ruleEditor.${value}`),
              }))}
              onValueChange={(v) => {
                if (v === 'work') {
                  update({ numberBasis: v })
                }
                if (v === 'volume') {
                  update({ numberBasis: v, volume: props.target.volume ?? { name: '' } })
                }
              }}
            />
          </Field>
        </Show>
        <label class="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!!props.target.volume}
            disabled={props.target.numberBasis === 'volume'}
            onCheckedChange={(on) => update({ volume: on ? { name: '' } : undefined })}
          />
          {t('library.ruleEditor.volumeScope')}
        </label>
        <Show when={props.target.volume}>
          {(scope) => (
            <div class="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel>{t('library.holdings.number')}</FieldLabel>
                <Input
                  value={scope().number?.value ?? ''}
                  onValueChange={(value) => {
                    const { number, ...rest } = scope()
                    update({
                      volume: value
                        ? { ...rest, number: { value, offset: number?.offset ?? 0 } }
                        : rest,
                    })
                  }}
                />
              </Field>
              <Show when={scope().number}>
                {(n) => (
                  <Offset
                    t={t}
                    value={n().offset}
                    change={(offset) =>
                      update({ volume: { ...scope(), number: { ...n(), offset } } })
                    }
                  />
                )}
              </Show>
              <Field>
                <FieldLabel>{t('library.fields.name')}</FieldLabel>
                <Input
                  value={scope().name ?? ''}
                  onValueChange={(v) => {
                    const { number } = scope()
                    update({ volume: { ...(number && { number }), ...(v && { name: v }) } })
                  }}
                />
              </Field>
            </div>
          )}
        </Show>
      </Show>
    </div>
  )
}

function Offset(props: { t: Translate; value: number; change: (n: number) => void }) {
  return (
    <Field>
      <FieldLabel>{props.t('library.holdings.offset')}</FieldLabel>
      <NumberInput
        step={1}
        increaseLabel={props.t('controls.number.increase')}
        decreaseLabel={props.t('controls.number.decrease')}
        value={String(props.value)}
        onValueChange={(v) => props.change(Number(v))}
      />
    </Field>
  )
}
