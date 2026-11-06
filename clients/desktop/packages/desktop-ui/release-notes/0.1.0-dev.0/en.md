# Desktop UI

Solid 1.9 components for native forms, stable validation feedback, accessible navigation, modal dialogs, popovers and window-level notifications. Selection controls share a logical collection with optional virtual rendering. The input family includes numeric stepping, a themed date calendar and CSS color editing with alpha. Dedicated subpaths provide CodeMirror Markdown editing, safe previews, Unovis charts and Pragmatic Drag and Drop integration with automatic scrolling and compact drag previews.

Install one Toaster per document and call toast.show from UI code. Messages survive the calling component and follow the active modal; ended handles stay inert. DialogHeader, DialogBody and DialogFooter keep headings and actions around independently scrolling content. FormFeedback provides direct error location with read-only hover and keyboard details. Controls share outline MDI symbols, compact segmented styling, native scrollbars and reduced-motion behavior.

Import the built component subpaths and `@kisaki3/desktop-ui/styles.css`. The stylesheet includes the desktop appearance defaults and supports ordinary CSS and Tailwind layer overrides. Runtime support follows the desktop Chromium baseline; SSR and other browser engines are not part of this release's verified scope.
