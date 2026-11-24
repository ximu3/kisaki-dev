# Using a translation catalog

`createTranslator(locale, catalog)` creates a formatter for a snapshot of the supplied catalog. Create another formatter when adopting a new locale or catalog. Formatters produce plain text, including literal markup. Insert the result as text.

## Fallback and arguments

A missing message uses the English text **and English formatting rules**. A supplied empty string is a translation and displays as empty. Present messages use the chosen locale. Calling an unknown key or passing invalid arguments raises `DesktopError` with code `InvalidInput`.

The English source determines which arguments each call accepts. A translation may omit a source parameter, but callers still supply the complete English argument set. Additional parameters and invalid runtime kinds are rejected. Numeric arguments must be finite and dates must be valid. A numeric timestamp must fall within the ECMAScript date range.

## Checking translations

`validateMessageCatalog` checks known leaves against the source, including uses inside nested ICU select and plural branches. Translations can omit parameters but cannot add a name or narrow the source's accepted kinds. Missing leaves are allowed by default. Complete validation requires every source key, including leaves whose translation is empty. Unknown leaves are retained so a catalog can be used across baseline versions.

Use `validateExtensionUiTranslationDefinition` to validate an extension's definition against the package's English baseline before offering it for adoption.
