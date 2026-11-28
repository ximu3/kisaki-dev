import { EntryDetails, type EntryDetailsProps } from '../../../domain-ui/library/entries/details'
import { catalogIcon } from '../../../domain-ui/library/icons'
import { PageBar } from '../../../domain-ui/page-bar'

export function EntryPage(props: EntryDetailsProps) {
  return (
    <EntryDetails
      {...props}
      layout={(view) => (
        <article class="flex h-full min-h-0 flex-col bg-background">
          <PageBar
            title={view.title}
            icon={catalogIcon[props.target.type]}
            afterTitle={view.status}
          >
            {view.actions}
          </PageBar>
          <div class="@container min-h-0 grow overflow-y-auto p-4">{view.content}</div>
        </article>
      )}
    />
  )
}
