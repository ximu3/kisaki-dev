# Desktop UI

Solid 1.9 components for native forms, stable validation feedback, accessible navigation, modal dialogs, popovers and window-level notifications. Import the built component subpaths and `@kisaki3/desktop-ui/styles.css`. The stylesheet includes the desktop appearance defaults and supports ordinary CSS and Tailwind layer overrides.

Group a field's static label and optional description before its control. FormFeedback presents the focused field's correction or a count that locates the first error. The input family supports numeric stepping, native date segments with a calendar, and CSS color editing with alpha. Field indicators share a trailing column. The calendar marks today with a dot and returns focus to the date editor when a day is selected.

Select and MultiSelect display a down chevron. Combobox displays paired chevrons and accepts one option record or an ordered array with `multiple`. Use `searchLabel` for the popup editor, `query` and `onQueryChange` for its text, and `filter={false}` for host-filtered results. The ref points to the field button. Search text and submitted keys have independent lifetimes. The optional virtual renderer uses `present` to retain visible rows through exit. Selected chips scroll within one row and can be removed directly.

Text-bearing surfaces fade in place. Hints enter in 60ms and exit in 40ms, anchored pickers and menus in 80ms and 60ms, and modal dialogs in 100ms and 80ms. Selection commits and focus returns while the outgoing panel keeps its last painted selection. The first pointer hover waits 300ms by default. Adjacent hints hand off immediately, and keyboard focus opens a hint directly. Controls respect reduced motion.

Install one Toaster per document and call `toast.show` from UI code. Messages survive their caller and follow the active modal. Cards enter and leave from the bottom and reposition in 100ms. Ended handles stay inert. DialogHeader, DialogBody and DialogFooter keep headings and actions around independently scrolling content. Pass a localized `closeLabel` to DialogHeader for a title-bar exit.

Dedicated subpaths provide CodeMirror Markdown editing, safe previews, Unovis charts and Pragmatic Drag and Drop integration with automatic scrolling and compact drag previews. Markdown formatting actions use a compact tinted toolbar with foreground hover feedback. Chart tooltips fade on visibility changes and follow the pointer directly. String templates render as text, and structured tooltips can return an HTMLElement.

Runtime support follows the desktop Chromium baseline.
