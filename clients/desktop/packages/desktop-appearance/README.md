# @kisaki3/desktop-appearance

Framework-independent visual values and CSS for Kisaki: 45 base tokens, pure value parsing, complete light and dark defaults, ordinary CSS and optional Tailwind 4 mappings. The package owns no application state or font resources.

## Pure values

```ts
import { tokens } from '@kisaki3/desktop-appearance/tokens'
import type { TokenValues } from '@kisaki3/desktop-appearance/tokens'
import { defaults } from '@kisaki3/desktop-appearance/defaults'

const custom: TokenValues = { ...defaults.dark, '--radius': '0px' }
```

`tokens` maps each fixed CSS property name to its value kind. `TokenValues` is a complete readonly branch; `FontTokenName` identifies the two font stacks and `VisualTokenName` covers the remaining slots. Defaults are frozen; copy a branch before editing. Desktop theme identities, font selections, persistence and system scheme resolution belong to their hosts.

Parse external values through the independent `values` entry:

```ts
import { parseTokenValue, parseTokenValues } from '@kisaki3/desktop-appearance/values'

const radius = parseTokenValue('--radius', '0px')
const branch = parseTokenValues({ ...defaults.dark, '--radius': radius })
```

Both functions return normalized CSS values and throw `TypeError` on invalid input. `parseTokenValues` requires exactly the 45 base keys, creates a new frozen branch and supplies no defaults. Inputs are not modified. The same parser runs in Node and browsers without reading a document or performing I/O. Importing `tokens` or `defaults` does not load it.

| Kind                                      | Accepted values                                                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color                                     | Hex, named colors, `transparent`, rgb/rgba, hsl/hsla, hwb, lab/lch, oklab/oklch and `color()` with predefined color spaces; CSS channel clipping semantics apply. |
| Radius, base font size                    | A nonnegative literal CSS length, including zero.                                                                                                                 |
| Weight                                    | `normal`, `bold` or a number from 1 to 1000.                                                                                                                      |
| Line height                               | `normal`, a nonnegative number, length or percentage.                                                                                                             |
| Letter spacing                            | `normal` or a literal length; negative spacing is allowed.                                                                                                        |
| Pane alpha, light strength, grain opacity | A percentage from 0% to 100%.                                                                                                                                     |
| Shadow                                    | `none` or comma-separated layers, each with an explicit color and two offsets; optional nonnegative blur, spread and `inset`. Offsets and spread may be negative. |
| Font family                               | A CSS font stack with quoted or unquoted names and generic families.                                                                                              |

Values describe independently editable visual properties. Formulas, relative colors, `color-mix()`, `var()`, `env()`, `attr()`, `currentColor`, system colors and cascade keywords are rejected. Color notation such as `oklch()` remains valid. Authors can calculate a palette before submitting its values; shared CSS owns runtime derivations. Numbers must be finite. Parsing does not verify font availability, display gamut or palette contrast.

## Ordinary CSS

```ts
import '@kisaki3/desktop-appearance/styles.css'
```

The stylesheet works without Tailwind or JavaScript. Light defaults apply to `:root`; set `data-color-scheme="dark"` or `"light"` on the document root to select a branch. Override the same base variables:

```ts
document.documentElement.dataset.colorScheme = 'dark'
document.documentElement.style.setProperty('--primary', 'oklch(0.64 0.17 256)')
document.documentElement.style.setProperty('--interface-scale', '125')
```

`--interface-scale` is a host projection in percent, with a fallback of 100, outside the saved vocabulary. Root font size is `--text-base-size × scale / 100`; rem typography and spacing follow it. Weight, line height and letter spacing use their base values. The CSS supplies no margin reset, focus suppression, font downloads or application layout.

Use base variables directly, or use the shared derivations:

- `--color-background` and `--color-surface` combine their colors with `--pane-alpha`. Other `--color-*` variables map directly, preserving each value's alpha.
- `--radius-sm/md/lg/xl` derive from `--radius` and remain valid at zero.
- `--text-xs` through `--text-9xl` and `--spacing` provide the rem scale.
- `--shadow-raised`, `--shadow-overlay` and `--shadow-modal` are the three base shadow tiers.

Default font stacks name Noto Sans SC Variable and Noto Sans Mono Variable, followed by system fallbacks. Font bytes and loading belong to the host; this package never loads font files.

## Tailwind 4

The consumer supplies its Tailwind build. Import the stylesheet and mapping after your chosen Tailwind layers:

```css
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
@import '@kisaki3/desktop-appearance/styles.css';
@import '@kisaki3/desktop-appearance/tailwind.css';
```

Utilities include `bg-primary`, `text-muted-foreground`, `rounded-md`, `shadow-overlay`, `font-sans` and `h-7`. `dark:` follows `data-color-scheme="dark"`. The mapping references ordinary CSS values without emitting another set of defaults. Runtime changes require no recompilation or package source scanning. The host chooses its own document reset.

ESM and TypeScript consumers use explicit subpaths. Browser presentation is tested against the repository's Chromium baseline; other browser engines and SSR integration are not claimed.

## Development

From the repository root:

```sh
pnpm --filter @kisaki3/desktop-appearance build
pnpm --filter @kisaki3/desktop-appearance typecheck
pnpm --filter @kisaki3/desktop-appearance test
pnpm desktop:test:consumers
```

The build generates CSS defaults from `src/defaults.ts` and combines them with `src/styles.css`. All outputs are prepared before replacing `dist`; failure or cancellation before adoption preserves the previous output. Public imports resolve to built files.

The consumer command prepares build → pack → check:package through Turbo, then installs the same `out/package/package.tgz` outside the repository. Publint and Are the Types Wrong both inspect this tarball; no checker repacks it. Are the Types Wrong checks its ESM JavaScript entrypoints. CSS subpaths are validated by actual stylesheet consumers, following the tool's [non-JavaScript asset guidance](https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/NoResolution.md). External consumers also check declarations with the workspace TypeScript version and `skipLibCheck: false`.

MIT. No fonts, icons or third-party images are distributed. The value parser bundles CSS Tree and its supporting code/data; `dist/THIRD-PARTY-NOTICES.txt` includes their MIT, CC0 and BSD notices. Package declarations expose no parser-library types.
