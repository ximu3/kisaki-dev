import { createSignal, For } from 'solid-js'
import {
  mdiEyeOutline,
  mdiInformationOutline,
  mdiLaptop,
  mdiMonitorEdit,
  mdiWeatherNight,
  mdiPaletteOutline,
  mdiCogOutline,
  mdiWeatherSunny,
  mdiWeatherSunset,
  mdiFormatFont,
} from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { appearanceModes, type AppearancePreferences } from '@kisaki3/desktop-contracts/appearance'
import type { PreferencesUpdate } from '@kisaki3/desktop-contracts/preferences'
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
import type { Translate } from '@kisaki3/desktop-localization'
import { reportError } from '../../../infrastructure/notifications'

const managementEntries = [
  { type: 'preferences', label: 'preferences.title', icon: mdiCogOutline },
  { type: 'themes', label: 'themes.title', icon: mdiPaletteOutline },
  { type: 'fonts', label: 'fonts.title', icon: mdiFormatFont },
  { type: 'systemIntegration', label: 'systemIntegration.title', icon: mdiMonitorEdit },
] as const

const modeIcons = { system: mdiLaptop, light: mdiWeatherSunny, dark: mdiWeatherNight }

export function ApplicationMenu(props: {
  t: Translate
  mode: AppearancePreferences['mode'] | undefined
  showSensitive: boolean | undefined
  updatePreferences: (input: PreferencesUpdate) => Promise<void>
  open: (target: NativeViewTarget) => Promise<boolean>
}) {
  const { t } = props
  const [saving, setSaving] = createSignal(false)
  const choicesDisabled = () => saving() || props.mode === undefined

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
    const previous = props.mode
    if (previous !== undefined && previous !== next) {
      void save({
        changes: { appearance: { mode: next } },
        expected: { appearance: { mode: previous } },
      })
    }
  }

  function changeSensitiveVisibility(next: boolean) {
    const previous = props.showSensitive
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
          aria-label={t('application.menu')}
        >
          <Icon path={mdiCogOutline} />
        </TooltipTrigger>
        <TooltipContent placement="right">{t('application.menu')}</TooltipContent>
      </Tooltip>

      <MenuContent class="min-w-48" placement="right-end">
        <Menu>
          <MenuSubTrigger icon={<Icon path={mdiWeatherSunset} />} disabled={choicesDisabled()}>
            {t('preferences.appearance.mode')}
          </MenuSubTrigger>
          <MenuContent class="min-w-40" aria-label={t('preferences.appearance.mode')}>
            <MenuGroup aria-label={t('preferences.appearance.mode')}>
              <For each={appearanceModes}>
                {(value) => {
                  const path = modeIcons[value]
                  return (
                    <MenuRadioItem
                      icon={<Icon path={path} />}
                      value={value}
                      selectedValue={props.mode ?? ''}
                      disabled={choicesDisabled()}
                      onValueChange={() => changeMode(value)}
                    >
                      {t(`appearance.modes.${value}`)}
                    </MenuRadioItem>
                  )
                }}
              </For>
            </MenuGroup>
          </MenuContent>
        </Menu>
        <MenuCheckboxItem
          icon={<Icon path={mdiEyeOutline} />}
          checked={props.showSensitive ?? false}
          disabled={choicesDisabled()}
          onCheckedChange={changeSensitiveVisibility}
        >
          {t('preferences.library.showNsfw')}
        </MenuCheckboxItem>

        <MenuSeparator />
        <For each={managementEntries}>
          {(item) => (
            <MenuItem
              icon={<Icon path={item.icon} />}
              onSelect={() => void props.open({ type: item.type })}
            >
              {t(item.label)}
            </MenuItem>
          )}
        </For>

        <MenuSeparator />
        <MenuItem
          icon={<Icon path={mdiInformationOutline} />}
          onSelect={() => void props.open({ type: 'about' })}
        >
          {t('application.about.title')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
