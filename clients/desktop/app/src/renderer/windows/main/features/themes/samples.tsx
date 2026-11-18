/** @fileoverview Presents a saved theme's paired color branches without changing the current UI. */

import { For } from 'solid-js'
import type { Theme } from '@kisaki3/desktop-contracts/appearance'
import type { Translate } from '@kisaki3/desktop-localization'

/** Displays both branches using their actual background, text and accent pairs. */
export function ThemeSamples(props: { theme: Theme; t: Translate }) {
  return (
    <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
      <For each={['light', 'dark'] as const}>
        {(scheme) => {
          const tokens = () => props.theme[scheme]
          return (
            <figure class="m-0 min-w-0 space-y-1.5">
              <figcaption class="text-xs font-medium text-muted-foreground">
                {props.t(`runtime.${scheme}`)}
              </figcaption>
              <div
                class="space-y-3 rounded-md border p-3"
                style={{
                  background: tokens()['--background'],
                  color: tokens()['--foreground'],
                  'border-color': tokens()['--border'],
                }}
              >
                <div class="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    class="size-2 rounded-full"
                    style={{ background: tokens()['--primary'] }}
                  />
                  <span class="text-sm font-medium">{props.t('runtime.themeSample')}</span>
                </div>
                <div aria-hidden="true" class="flex gap-1.5">
                  <span
                    class="block h-3 w-11 rounded-sm"
                    style={{ background: tokens()['--primary'] }}
                  />
                  <span
                    class="block h-3 w-8 rounded-sm"
                    style={{ background: tokens()['--accent'] }}
                  />
                  <span
                    class="block h-3 w-6 rounded-sm"
                    style={{ background: tokens()['--muted'] }}
                  />
                </div>
              </div>
            </figure>
          )
        }}
      </For>
    </div>
  )
}
