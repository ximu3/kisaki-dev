import type { JSX } from '@solidjs/web'
import { createSignal, onSettled } from 'solid-js'

const key = 'library.explorerWidth'

const defaultWidth = 16

export function LibraryPanes(props: { left: JSX.Element; label: string; children: JSX.Element }) {
  const stored = Number(localStorage.getItem(key))
  const [width, setWidth] = createSignal(stored >= 16 && stored <= 28 ? stored : defaultWidth)
  const [room, setRoom] = createSignal(0)
  let container!: HTMLDivElement
  let unit!: HTMLSpanElement
  const maximum = () => Math.min(28, Math.max(16, room() - 30 - 0.25))
  const actual = () => Math.min(width(), maximum(), room() * 0.4 || defaultWidth)
  onSettled(() => {
    function measure() {
      setRoom(container.clientWidth / unit.getBoundingClientRect().width)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(unit)
    measure()
    return () => observer.disconnect()
  })
  function save(next: number) {
    const value = Math.max(defaultWidth, Math.min(next, maximum()))
    setWidth(value)
    localStorage.setItem(key, String(value))
  }
  let drag: { x: number; width: number } | undefined
  return (
    <div
      ref={(node) => {
        container = node
      }}
      class="relative flex min-h-0 grow"
    >
      <span
        ref={(node) => {
          unit = node
        }}
        aria-hidden="true"
        class="invisible pointer-events-none absolute size-[1rem]"
      />
      <div class="min-w-0 shrink-0" style={{ width: actual() + 'rem' }}>
        {props.left}
      </div>
      <div
        role="separator"
        tabindex={0}
        aria-label={props.label}
        aria-orientation="vertical"
        aria-valuemin={Math.min(16, actual())}
        aria-valuemax={maximum()}
        aria-valuenow={actual()}
        class="absolute inset-y-0 z-10 w-1 cursor-col-resize touch-none hover:bg-primary focus-visible:bg-primary"
        style={{ left: actual() + 'rem' }}
        onPointerDown={(e) => {
          if (e.button === 0) {
            e.preventDefault()
            e.currentTarget.setPointerCapture(e.pointerId)
            drag = { x: e.clientX, width: actual() }
          }
        }}
        onPointerMove={(e) => {
          if (drag) {
            setWidth(
              Math.min(
                maximum(),
                Math.max(
                  defaultWidth,
                  drag.width + (e.clientX - drag.x) / unit.getBoundingClientRect().width,
                ),
              ),
            )
          }
        }}
        onLostPointerCapture={() => {
          if (drag) {
            drag = undefined
            save(width())
          }
        }}
        onDblClick={() => save(defaultWidth)}
        onKeyDown={(e) => {
          const next = {
            ArrowLeft: width() - 1,
            ArrowRight: width() + 1,
            Home: defaultWidth,
            End: maximum(),
          }[e.key]
          if (next !== undefined) {
            e.preventDefault()
            save(next)
          }
        }}
      />
      <div class="min-h-0 min-w-0 grow">{props.children}</div>
    </div>
  )
}
