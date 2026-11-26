# Using the Solid controls

Import each family from its package subpath and load `@kisaki3/desktop-ui/styles.css` once. This includes the appearance defaults. Supply localized labels and accessible names, including names for icon-only buttons and modal dialogs. The host owns application state, persistence and business validation.

## Icons

Import `Icon` from `@kisaki3/desktop-ui/icon` and a named MDI path from `@mdi/js`, for example `<Icon path={mdiCogOutline} />`. The icon inherits the text color and is decorative by default. Give an icon-only button its own accessible name. For a standalone icon that conveys information, pass a localized `label`.

## Form controls

A supplied value is controlled. Adopt a requested change to make it visible. A default initializes local state and supplies the form reset baseline. Checkbox submission follows its checked state. Indeterminate presentation is independent. Numeric editing preserves the native string value, including an empty field. Date editing accepts complete calendar dates. Typed color values keep their CSS color space; picker channel edits produce sRGB hexadecimal.

Use `createForm` to coordinate native constraints, business issues and submission. An invalid submit locates the first failing field and resolves to false. Concurrent submissions share the pending operation. Success resolves to true after the handler settles. A rejected handler keeps its error visible and rejects the submission. Use the same submission operation for keyboard shortcuts and close confirmation. When a field belongs to an inactive page, supply a location handler that shows the field before focusing it.

A `NumberInput` with `positive` accepts values greater than zero. With `step="any"`, typing accepts positive fractions and the decrease button stops when the next full step would reach zero.

A select or combobox can keep committed choices across new search results. An unavailable committed choice remains visible and makes the field invalid. Set `filter={false}` for options already filtered by the host. Custom row layouts use the supplied option renderer to preserve keyboard navigation and accessibility. For virtualization, give the viewport a bounded height. Estimates and measurements are positive border-box heights in CSS pixels. The visible range includes overscan and excludes its upper bound. Supply stable keys and retain offscreen rows that still own focus or active interactions. Dispose the observer when unmounting a measured row.

## Dialogs, popups and notifications

Controlled dialogs, popovers and menus request changes through their callbacks. The owner decides whether to adopt a close request or wait for saving. Dialog content remains mounted during its exit. Supply a title or accessible label. Nest submenu content inside the parent menu content. Menu selection normally closes the tree. A prevented click or `closeOnSelect={false}` keeps it open. Tabs keep panels mounted. Manual tab activation uses Enter or Space.

Install one Toaster for the document before calling `toast.show`. Its returned handle can update or dismiss the message. Dismissal ends the handle immediately. Loading suspends automatic dismissal. Updating a loading message to a result starts its display duration unless the message is persistent. The host owns any business action triggered from a notification.

## Content and resources

The host owns image URLs and releases them when their consumers finish. Markdown editing borrows the mounted CodeMirror view. The component destroys the view when its owner is released. External text updates wait for active composition and do not add an undo step. Chart instances, drag registrations, observers and presentation listeners follow their Solid owners. The host supplies chart data, stable item identity and permission to reorder or drop.

For edge scrolling during a drag, pass `ReorderableList` a `viewport` accessor that returns the scrollable element. This can be the list itself or its scrolling parent. Omit `viewport` for a plain list.
