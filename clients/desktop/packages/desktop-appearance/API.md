# Applying a theme

Import `@kisaki3/desktop-appearance/styles.css` once for the built-in light and dark schemes and their derived CSS variables. The host selects the scheme and owns interface scaling, font resources and the elements on which overrides are installed. Tailwind consumers can also import `@kisaki3/desktop-appearance/tailwind.css` to use the same vocabulary. The runtime values come from the ordinary stylesheet.

## Preparing values

Use `/tokens` for the fixed names and value kinds and `/defaults` for the frozen light and dark branches. `--chrome` describes window and navigation surfaces, `--secondary` fills secondary actions, and `--muted` fills low-emphasis surfaces. Each has its paired foreground. Base font-family slots accept CSS font stacks. Interface scale and derived CSS variables are managed separately.

Use `parseTokenValue` from `/values` to normalize a standalone value before adoption. Formulas, references, unknown names and invalid CSS throw `TypeError`. Whitespace, CSS comments and standalone zero lengths are normalized. Each shadow layer requires a nonnegative blur radius. Its offsets and spread may be negative.

`parseTokenValues` checks a whole branch and returns a new frozen value. Missing or extra names and invalid values fail the entire parse. The supplied object is left intact.
