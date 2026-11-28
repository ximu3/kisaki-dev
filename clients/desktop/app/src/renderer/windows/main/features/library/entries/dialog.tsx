import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { EntryDetails, type EntryDetailsProps } from '../../../domain-ui/library/entries/details'
import { catalogIcon } from '../../../domain-ui/library/icons'

export function EntryDialog(props: EntryDetailsProps) {
  return (
    <EntryDetails
      {...props}
      layout={(view) => (
        <DialogContent size="xl" fill>
          <DialogHeader closeLabel={props.api.t('actions.close')}>
            <DialogTitle class="flex min-w-0 items-center gap-2">
              <Icon path={catalogIcon[props.target.type]} class="size-4 shrink-0" />
              <span class="truncate">{view.title}</span>
            </DialogTitle>
          </DialogHeader>
          <DialogBody class="@container min-h-0 overflow-y-auto p-4">{view.content}</DialogBody>
          <DialogFooter>
            <div class="flex w-full items-center justify-between">
              <div>{view.status}</div>
              <div class="flex items-center gap-1.5">{view.actions}</div>
            </div>
          </DialogFooter>
        </DialogContent>
      )}
    />
  )
}
