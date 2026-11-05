/** @fileoverview Local dialog, menu, disclosure, focus and feedback combinations. */

import { createSignal, Show } from 'solid-js'
import {
  AlertDialogContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@kisaki3/desktop-ui/dialog'
import { ContextMenu, DropdownMenu, MenuItem } from '@kisaki3/desktop-ui/menu'
import { Popover } from '@kisaki3/desktop-ui/popover'
import { Toast, ToastRegion } from '@kisaki3/desktop-ui/toast'
import { Tooltip } from '@kisaki3/desktop-ui/tooltip'
import { Tabs } from '@kisaki3/desktop-ui/tabs'
import { Collapsible } from '@kisaki3/desktop-ui/collapsible'
import { Button } from '@kisaki3/desktop-ui/button'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Badge } from '@kisaki3/desktop-ui/badge'
import { Link } from '@kisaki3/desktop-ui/link'
import { Image } from '@kisaki3/desktop-ui/image'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { Progress } from '@kisaki3/desktop-ui/progress'
import { Separator } from '@kisaki3/desktop-ui/separator'
import { ScrollArea } from '@kisaki3/desktop-ui/scroll-area'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kisaki3/desktop-ui/table'

export function Actions() {
  const [open, setOpen] = createSignal(false)
  const [dirty, setDirty] = createSignal(false)
  const [message, setMessage] = createSignal('')
  const content = () => (
    <>
      <MenuItem disabled>Archive</MenuItem>
      <MenuItem onSelect={() => setMessage('Copied title')}>Copy title</MenuItem>
      <MenuItem onSelect={() => setMessage('Pinned entry')}>Pin entry</MenuItem>
    </>
  )

  return (
    <>
      <div class="actions">
        <Dialog
          open={open()}
          onOpenChange={setOpen}
          onCloseRequest={(e) => {
            if (dirty()) {
              e.preventDefault()
            }
          }}
        >
          <DialogTrigger>Edit entry</DialogTrigger>
          <DialogContent>
            <DialogTitle>Edit entry</DialogTitle>
            <label>
              <input
                type="checkbox"
                checked={dirty()}
                onChange={(e) => setDirty(e.currentTarget.checked)}
              />
              Keep editing
            </label>
            <Dialog>
              <DialogTrigger variant="outline">Remove cover</DialogTrigger>
              <AlertDialogContent>
                <DialogTitle>Remove cover?</DialogTitle>
                <DialogClose>Keep cover</DialogClose>
              </AlertDialogContent>
            </Dialog>
            <DialogClose>Close editor</DialogClose>
          </DialogContent>
        </Dialog>
        <DropdownMenu label="Entry actions" trigger="Actions">
          {content()}
        </DropdownMenu>
        <Tooltip content="Keyboard shortcut: F1" delayMs={40}>
          {(hint) => (
            <Button {...hint} variant="text">
              Help
            </Button>
          )}
        </Tooltip>
        <Popover trigger="Details">
          <Link href="#related">Related titles</Link>
        </Popover>
      </div>
      <ContextMenu label="Entry menu" trigger={<span>Blue Hour</span>}>
        {content()}
      </ContextMenu>
      <Separator />
      <Tabs
        label="Details"
        tabs={[
          {
            value: 'content',
            label: 'Content',
            content: () => (
              <ScrollArea>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Blue Hour</TableCell>
                      <TableCell>
                        <Badge>Reading</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollArea>
            ),
          },
          {
            value: 'related',
            label: 'Related',
            content: () => <EmptyState id="related">No related titles</EmptyState>,
          },
        ]}
      />
      <Collapsible summary="Import status">
        <Alert>Preparing cover</Alert>
        <Spinner label="Loading cover" />
        <Progress aria-label="Imported titles" value={2} max={4} />
        <Image alt="Cover unavailable" />
      </Collapsible>
      <ToastRegion label="Notifications">
        <Show when={message()}>
          <Toast message={message()} dismissLabel="Dismiss" onDismiss={() => setMessage('')} />
        </Show>
      </ToastRegion>
    </>
  )
}
