import { isWorkType, type EntryRef } from '@kisaki3/desktop-contracts/library'
import type { EntryLocation } from '../../../../../shared/window-api/library'
import type { MainClient } from '../../../../infrastructure/api'
import type { LibraryVisit } from './navigation'
import { EntryDetails, type EntryPanel } from '../../domain-ui/library/entries/details'
import { DirectoryMenu } from './holdings/directories'
import { LaunchConfigs } from './holdings/game/configuration'
import { WorkParts } from './parts'
import { Annotations } from './records/annotations'
import { Activities } from '../../domain-ui/library/activities'
import { Notes } from './records/notes'

export function EntryPage(props: {
  api: MainClient
  target: EntryRef
  visit?: LibraryVisit | undefined
  location?: EntryLocation
  openOrganizer: (kind: 'tag' | 'collection', id: string, name: string) => void
  open: (ref: EntryRef) => void
}) {
  const { api } = props
  function panel(tab: EntryPanel) {
    const entry = props.target
    if (tab === 'notes') {
      return <Notes api={api} entry={entry} openEntry={props.open} />
    }
    if (!isWorkType(entry.type)) {
      return null
    }
    const work = { type: entry.type, id: entry.id }
    switch (tab) {
      case 'configs':
        return (
          work.type === 'game' && (
            <LaunchConfigs
              api={api}
              game={work.id}
              {...(props.location?.config && { initial: props.location.config })}
            />
          )
        )
      case 'parts':
        return (
          work.type !== 'game' && (
            <WorkParts
              api={api}
              work={{ type: work.type, id: work.id }}
              {...(props.location && { location: props.location })}
            />
          )
        )
      case 'activity':
        return (
          <Activities api={api} query={{ scope: { type: 'works', refs: [work] } }} work={work} />
        )
      case 'annotations':
        return <Annotations api={api} scope={{ type: 'work', work }} />
    }
  }

  return (
    <EntryDetails
      api={api}
      target={props.target}
      open={props.open}
      openOrganizer={props.openOrganizer}
      {...(props.location && { location: props.location })}
      receipt={props.visit?.receipt}
      initialTab={props.visit?.tab}
      tabChanged={(tab) => {
        if (props.visit) {
          props.visit.tab = tab
        }
      }}
      workActions={(work) => <DirectoryMenu api={api} work={work} />}
      panel={panel}
    />
  )
}
