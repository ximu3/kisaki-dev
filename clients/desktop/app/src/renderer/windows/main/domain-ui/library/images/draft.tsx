import { createSignal, onCleanup, Show } from 'solid-js'
import type { ImageChoice } from '../../../../../../shared/window-api'
import type { MainClient } from '../../../../../infrastructure/api'
import { reportError } from '../../../../../infrastructure/notifications'
import { CropImage } from './crop'

export function createImageDraft(api: MainClient) {
  const [current, setCurrent] = createSignal<{
      image: ImageChoice
      adopt: (image: ImageChoice) => void
    }>(),
    [choosing, setChoosing] = createSignal(false)
  const held = new Map<string, ImageChoice>()
  let closed = false
  async function release(image: ImageChoice) {
    held.delete(image.id)
    await api.call('resources.release', image.id)
  }
  function clear() {
    const selection = current()
    setCurrent(undefined)
    if (selection) {
      void release(selection.image).catch(reportError)
    }
  }
  onCleanup(() => {
    closed = true
    for (const image of held.values()) {
      void release(image).catch(reportError)
    }
  })
  async function choose(adopt: (image: ImageChoice) => void) {
    if (choosing() || current()) {
      return
    }
    setChoosing(true)
    try {
      const image = await api.call('images.choose')
      if (!image) {
        return
      }
      if (closed) {
        await release(image)
        return
      }
      held.set(image.id, image)
      setCurrent({ image, adopt })
    } catch (cause) {
      reportError(cause)
    } finally {
      if (!closed) {
        setChoosing(false)
      }
    }
  }
  function Dialog() {
    return (
      <Show when={current()} keyed>
        {(pick) => (
          <CropImage
            api={api}
            image={pick.image}
            close={clear}
            apply={(image) => {
              if (closed || current() !== pick) {
                if (image.id !== pick.image.id) {
                  void release(image).catch(reportError)
                }
                return
              }
              const { image: original, adopt } = pick
              held.set(image.id, image)
              setCurrent(undefined)
              if (image.id !== original.id) {
                void release(original).catch(reportError)
              }
              adopt(image)
            }}
          />
        )}
      </Show>
    )
  }
  return { choose, busy: () => choosing() || !!current(), ids: () => [...held.keys()], Dialog }
}
