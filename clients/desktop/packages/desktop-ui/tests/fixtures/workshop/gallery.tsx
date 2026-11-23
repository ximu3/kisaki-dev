import { createSignal } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Info } from '@lucide/solid'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Badge } from '@kisaki3/desktop-ui/badge'
import { Button } from '@kisaki3/desktop-ui/button'
import { Collapsible } from '@kisaki3/desktop-ui/collapsible'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { Image } from '@kisaki3/desktop-ui/image'
import { List, ListItem } from '@kisaki3/desktop-ui/list'
import { Progress } from '@kisaki3/desktop-ui/progress'
import { ScrollArea } from '@kisaki3/desktop-ui/scroll-area'
import { Separator } from '@kisaki3/desktop-ui/separator'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import {
  ScrollableTable,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSpacer,
} from '@kisaki3/desktop-ui/table'
import type {} from './api.js'

export function Gallery(): JSX.Element {
  const [expanded, setExpanded] = createSignal(false)
  window.fixture.requestDisclosure = setExpanded

  return (
    <section id="gallery">
      <h2>Presentation</h2>
      <div class="row">
        <Button>Primary</Button>
        <Button variant="destructive">Danger</Button>
        <Button variant="outline" class="host-override">
          Override
        </Button>
        <Button variant="ghost">Ghost</Button>
        <Button disabled>Disabled</Button>
        <Button busy>Saving</Button>
      </div>
      <div class="row">
        <Badge>Ready</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Spinner label="Loading" />
      </div>
      <Progress value={0.65} aria-label="Progress" />
      <Alert tone="info">The sample preserves ordinary document behavior.</Alert>
      <Separator />
      <Collapsible
        summary="More information"
        open={expanded()}
        onOpenChange={(open) => window.fixture.requestDisclosure?.(open)}
      >
        <p>Native disclosure content.</p>
      </Collapsible>
      <ScrollArea aria-label="Sample table">
        <Table>
          <TableCaption>Synthetic rows</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Sample A</TableCell>
              <TableCell>Ready</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ScrollArea>
      <ScrollableTable
        aria-label="Scrollable sample table"
        aria-rowcount={28}
        columns="minmax(0, 1fr) 8rem"
        minWidth="42rem"
        style={{ height: '9rem' }}
        header={
          <TableRow>
            <TableHead scope="col">Name</TableHead>
            <TableHead scope="col">
              <Button variant="text">Sort by status</Button>
            </TableHead>
          </TableRow>
        }
      >
        <TableRow aria-rowindex={2}>
          <TableHead scope="row">First sample</TableHead>
          <TableCell>Ready</TableCell>
        </TableRow>
        <TableSpacer height={800} />
        <TableRow aria-rowindex={28}>
          <TableHead scope="row">Last sample</TableHead>
          <TableCell>Ready</TableCell>
        </TableRow>
      </ScrollableTable>
      <List>
        <ListItem title="Sample item" description="Read-only entry" icon={<Info />} />
      </List>
      <Image alt="Unavailable sample" src="/missing.png" />
      <EmptyState
        heading="No additional samples"
        description="Add an item when one is available."
      />
    </section>
  )
}
