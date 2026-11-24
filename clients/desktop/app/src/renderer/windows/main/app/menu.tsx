import { createSignal, For } from 'solid-js'
import {
  Eye,
  Info,
  Monitor,
  MonitorCog,
  Moon,
  Palette,
  Settings,
  Sun,
  SunMoon,
  Type,
} from '@lucide/solid'
import { appearanceModes, type AppearancePreferences } from '@kisaki3/desktop-contracts/appearance'
import type { PreferencesSnapshot, PreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioItem,
  MenuSeparator,
  MenuSubTrigger,
  MenuTrigger,
} from '@kisaki3/desktop-ui/menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import type { MainClient } from '../../../infrastructure/api'
import { reportError } from '../../../infrastructure/notifications'

const managementEntries = [
  { type: 'preferences', label: 'preferences', icon: Settings },
  { type: 'themes', label: 'themes', icon: Palette },
  { type: 'fonts', label: 'fonts', icon: Type },
  { type: 'systemIntegration', label: 'system', icon: MonitorCog },
] as const

const modeIcons = { system: Monitor, light: Sun, dark: Moon }

export function ApplicationMenu(props: {
  api: MainClient
  preferences: PreferencesSnapshot | undefined
  updatePreferences: (input: PreferencesUpdate) => Promise<void>
  open: (target: NativeViewTarget) => Promise<boolean>
}) {
  const { api } = props
  const mode = () => props.preferences?.appearance.mode
  const showSensitive = () => props.preferences?.library.showNsfw
  const [saving, setSaving] = createSignal(false)
  const choicesDisabled = () => saving() || !props.preferences

  async function save(input: PreferencesUpdate) {
    setSaving(true)
    try {
      await props.updatePreferences(input)
    } catch (cause) {
      reportError(cause)
    } finally {
      setSaving(false)
    }
  }

  function changeMode(next: AppearancePreferences['mode']) {
    const previous = mode()
    if (previous !== undefined && previous !== next) {
      void save({
        changes: { appearance: { mode: next } },
        expected: { appearance: { mode: previous } },
      })
    }
  }

  function changeSensitiveVisibility(next: boolean) {
    const previous = showSensitive()
    if (previous !== undefined) {
      void save({
        changes: { library: { showNsfw: next } },
        expected: { library: { showNsfw: previous } },
      })
    }
  }

  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          as={MenuTrigger}
          variant="ghost"
          size="icon-lg"
          class="rail-action size-10"
          aria-label={api.t('runtime.appMenu')}
        >
          <Settings />
        </TooltipTrigger>
        <TooltipContent placement="right">{api.t('runtime.appMenu')}</TooltipContent>
      </Tooltip>

      <MenuContent class="min-w-48" placement="right-end">
        <Menu>
          <MenuSubTrigger icon={<SunMoon />} disabled={choicesDisabled()}>
            {api.t('runtime.fields.mode')}
          </MenuSubTrigger>
          <MenuContent class="min-w-40" aria-label={api.t('runtime.fields.mode')}>
            <MenuGroup aria-label={api.t('runtime.fields.mode')}>
              <For each={appearanceModes}>
                {(value) => {
                  const Icon = modeIcons[value]
                  return (
                    <MenuRadioItem
                      icon={<Icon />}
                      value={value}
                      selectedValue={mode() ?? ''}
                      disabled={choicesDisabled()}
                      onValueChange={() => changeMode(value)}
                    >
                      {api.t(`runtime.choices.${value}`)}
                    </MenuRadioItem>
                  )
                }}
              </For>
            </MenuGroup>
          </MenuContent>
        </Menu>
        <MenuCheckboxItem
          icon={<Eye />}
          checked={showSensitive() ?? false}
          disabled={choicesDisabled()}
          onCheckedChange={changeSensitiveVisibility}
        >
          {api.t('runtime.fields.showNsfw')}
        </MenuCheckboxItem>

        <MenuSeparator />
        <For each={managementEntries}>
          {(item) => (
            <MenuItem icon={<item.icon />} onSelect={() => void props.open({ type: item.type })}>
              {api.t(`runtime.${item.label}`)}
            </MenuItem>
          )}
        </For>

        <MenuSeparator />
        <MenuItem icon={<Info />} onSelect={() => void props.open({ type: 'about' })}>
          {api.t('runtime.about')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
