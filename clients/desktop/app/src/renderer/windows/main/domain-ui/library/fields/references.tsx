import { For } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Input } from '@kisaki3/desktop-ui/input'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import type { ExternalLink, ExternalIdentity } from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'

type Props<T> = { t: Translate; value: readonly T[]; change: (value: T[]) => void }
function PairList(props: {
  t: Translate
  label: string
  labels: readonly [string, string]
  pairs: readonly (readonly [string, string])[]
  change: (pairs: (readonly [string, string])[]) => void
}) {
  function changeCell(i: number, side: number, value: string) {
    props.change(
      props.pairs.map((pair, n) =>
        n !== i ? pair : [side === 0 ? value : pair[0], side === 1 ? value : pair[1]],
      ),
    )
  }
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <For each={props.pairs.map((_, i) => i)}>
        {(i) => (
          <div class="grid grid-cols-[1fr_1fr_auto] gap-2">
            <For each={[0, 1] as const}>
              {(side) => (
                <Input
                  aria-label={props.labels[side]}
                  value={props.pairs[i]![side]}
                  onValueChange={(v) => changeCell(i, side, v)}
                />
              )}
            </For>
            <Button
              variant="ghost"
              onClick={() => props.change(props.pairs.filter((_, n) => n !== i))}
            >
              {props.t('actions.remove')}
            </Button>
          </div>
        )}
      </For>
      <Button variant="outline" onClick={() => props.change([...props.pairs, ['', '']])}>
        {props.t('actions.create')}
      </Button>
    </Field>
  )
}
export function LinkFields(props: Props<ExternalLink>) {
  const t = props.t
  return (
    <PairList
      t={t}
      label={t('library.fields.links')}
      labels={[t('library.fields.name'), t('library.launchConfig.url')]}
      pairs={props.value.map((item) => [item.name, item.url])}
      change={(pairs) => props.change(pairs.map(([name, url]) => ({ name, url })))}
    />
  )
}
export function IdentityFields(props: Props<ExternalIdentity>) {
  const t = props.t
  return (
    <PairList
      t={t}
      label={t('library.fields.id')}
      labels={[t('library.queryFields.sources'), t('library.fields.id')]}
      pairs={props.value.map((item) => [item.source, item.sourceId])}
      change={(pairs) => props.change(pairs.map(([source, sourceId]) => ({ source, sourceId })))}
    />
  )
}
