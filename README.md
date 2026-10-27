# RangeSelector

The usability-first date range picker. No dependencies.

**[Live demo & playground →](https://juancresc.github.io/range-selector/)**

## Why

Classic range pickers give you one calendar and expect two clicks. Many users can't
tell which date they're picking, From or To, or how to change one end without
starting over.

RangeSelector shows the range as two consecutive inputs, **From → To**. You always
see which date you're editing, you can change either end on its own, and you can
type a date instead of hunting for it in a calendar.

## Features

- **Two typeable, masked inputs** (`dd/mm/yyyy`) inside a single control.
  The `__/__/____` guide fills in as you type; completing From jumps to To
  automatically. A two-digit year → `20yy`.
- **Click a field**: opens the calendar for that date. Picking a day changes only
  that field and closes. Days that would invert the range aren't offered.
  Focus stays in the field, so you can also type.
- **📅 button**: opens the range calendar. From first, then To; a day before From
  restarts the range there.
- **Open ranges**: only From or only To is valid (the empty side reads «Sin límite», "No limit").
- **Meaningful empty state**: with no dates, the control says what that means («Todas las fechas»,
  «Este mes»…) and the panel's left button returns to that state.
- Presets (Today, Yesterday, This week, Last 7/30 days, This month, Last month, Year to date),
  `min`/`max` limits, validation (31/02, out of range) that blocks submit, From after To
  gets swapped, full keyboard support, ARIA.
- **Optional time**: `time: true` adds an optional `hh:mm` to each date; `time: 'only'`
  makes it a range of hours (see [Time](#time)).
- Submits two `<input type="hidden">` with the dates in ISO (`YYYY-MM-DD`).

> The default UI texts are in Spanish; use `locale: 'en'` for English (see [Locale](#locale)).
> Options have English aliases: `from`/`to` for `desde`/`hasta`, and so on.

## Install

```bash
npm install range-selector
```

```js
const RangeSelector = require('range-selector');   // or: import RangeSelector from 'range-selector'
import 'range-selector/range-selector.css';
```

Or copy `src/range-selector.js` and `src/range-selector.css` into your project. Types
are included (`src/range-selector.d.ts`).

## Usage

```html
<link rel="stylesheet" href="src/range-selector.css">

<span id="lbl">Date</span>
<div data-range-selector
     data-name-desde="desde" data-name-hasta="hasta"
     data-desde="2026-10-01" data-hasta="2026-10-11"
     data-vacio="All dates"
     aria-labelledby="lbl"></div>

<script src="src/range-selector.js"></script>   <!-- auto-initializes [data-range-selector] -->
```

Or from JS:

```js
const rs = new RangeSelector('#period', {
    nameDesde: 'desde', nameHasta: 'hasta',
    min: '2025-01-01', max: new Date(),
    vacio: 'This month',
    onChange: ({ desde, hasta }) => console.log(desde, hasta),
});
```

The same, with the English aliases and texts:

```js
const rs = new RangeSelector('#period', {
    nameFrom: 'from', nameTo: 'to',
    min: '2025-01-01', max: new Date(),
    empty: 'This month',
    locale: 'en',
    onChange: ({ from, to }) => console.log(from, to),
});
```

## Options

Each option in parentheses is an English alias; both names (and both `data-*`
attributes) work the same.

| Option        | data-attribute       | Default              | |
|---------------|----------------------|----------------------|---|
| `nameDesde` (`nameFrom`) | `data-name-desde` (`data-name-from`) | `'desde'` | `name` of the From hidden input |
| `nameHasta` (`nameTo`)   | `data-name-hasta` (`data-name-to`)   | `'hasta'` | `name` of the To hidden input |
| `desde` (`from`) | `data-desde` (`data-from`) | `null`          | Initial From value (`'YYYY-MM-DD'` or `Date`) |
| `hasta` (`to`)   | `data-hasta` (`data-to`)   | `null`          | Initial To value |
| `min` / `max` | `data-min` / `data-max` | `null`            | Limits; outside them, days are disabled in the calendar and typing them is an error |
| `vacio` (`empty`) | `data-vacio` (`data-empty`) | locale's: `'Todas las fechas'` / `'All dates'` | What choosing no range means (text of the empty control and of the button that clears it) |
| `sinLimite` (`noLimit`) | `data-sin-limite` (`data-no-limit`) | locale's: `'Sin límite'` / `'No limit'` | Empty side of an open range |
| `presets`     | `data-presets="false"` | `true`             | `true`, `false` or `[{ label, desde, hasta }]` (or `from`/`to`) |
| `months`      | `data-months`        | `2`                  | Months visible in the calendar (always 1 on mobile) |
| `autoAdvance` | `data-auto-advance="false"` | `true`        | Jump to To when From is complete |
| `time`        | `data-time="true"` / `"only"` | `false`     | `false` date · `true` date + optional time · `'only'` time only (see [Time](#time)) |
| `step`        | `data-step`          | `30`                 | Minutes between the times offered in the panel |
| `locale`      | `data-locale`        | `'es'`               | `'es'`, `'en'` or an object with texts (see [Locale](#locale)) |
| `onChange`    | —                    | `null`               | `fn({ desde, hasta })` in ISO |
| `locale`      | —                    | Spanish              | Texts and month/day names (see `RangeSelector.locale`) |

## Time

`time` is off by default. Turn it on in one of two ways:

**`time: true`: date and optional time.** Fields become `dd/mm/yyyy hh:mm`, and the
time is optional: typing only the date means the whole day, so From is `00:00` and
To is `23:59`. The panel shows a list of times (every `step` minutes) next to the
calendar for the active field. Picking a day keeps that field's time, and the panel
stays open until **Listo** so you can adjust it. Values are `YYYY-MM-DDTHH:mm`, the
same format as `<input type="datetime-local">`.

```html
<div data-range-selector data-time="true" data-step="15"
     data-desde="2026-10-01T08:00" data-hasta="2026-10-11"></div>
<!-- submits desde=2026-10-01T08:00 & hasta=2026-10-11T23:59 -->
```

**`time: 'only'`: a range of hours.** Fields are `hh:mm`, there is no calendar and the
button opens the list of times (From first, then To). No presets by default, and the
empty state reads «Todo el día» ("all day"). Values are `HH:mm`.

```js
new RangeSelector('#hours', { time: 'only', desde: '09:00', hasta: '18:00', min: '07:00', max: '22:00' });
// getValue() → { desde: '09:00', hasta: '18:00' }
```

`desde`, `hasta`, `min`, `max`, `setValue()` and preset values take the same format as
the output (or a `Date`). Limits work to the minute: on the `min` day only times from
`min` on are offered. As with dates, From after To is swapped, so a time-only range
can't cross midnight.

## Locale

The texts default to Spanish. `locale: 'en'` switches to the built-in English texts. An
object changes only the texts it includes, on top of Spanish, or on top of the locale
named in `base`:

```js
new RangeSelector('#period', { locale: 'en' });
new RangeSelector('#period', { locale: { base: 'en', listo: 'Apply', vacio: 'Any time' } });
```

The keys are those of `RangeSelector.locales.en`: month and weekday names, field labels,
button labels, error messages, the format in each field's aria-label (`formatos`), a
`dia(date, months)` function for each calendar day's aria-label, and the default preset
labels (`presets`).

## Methods

| | |
|---|---|
| `getValue()` | `{ desde: 'YYYY-MM-DD' \| '', hasta: …, from, to }` (`from`/`to` are the same values; with `time`: `'YYYY-MM-DDTHH:mm'` or `'HH:mm'`) |
| `setValue(desde, hasta)` | ISO, `Date` or `null` |
| `clear()` | Clears the range |
| `setLimits(min, max)` | Changes the limits (revalidates typed input) |
| `validate()` | Parses typed input; `false` if there are errors |
| `open(campo?, modo?)` / `close()` / `isOpen()` | Panel; `campo` = `'desde'` \| `'hasta'` (or `'from'` \| `'to'`), `modo` = `'rango'` (default) \| `'campo'` (or `'range'` \| `'field'`) |
| `destroy()` | Removes listeners and markup |
| `RangeSelector.init(scope?)` | Initializes the `[data-range-selector]` elements in `scope` (runs automatically on load) |
| `RangeSelector.utils` | Pure functions: `parse`, `mask`, `toISO`, `toDMY`, `fromISO`, `pick`… |

## Events

- `rangeselector:change` (bubbles) — `event.detail = { desde, hasta, from, to }` in ISO, every time
  the hidden inputs change.
- Inside a `<form>`: on `submit` it parses typed input and, if a date is invalid,
  cancels the submit and focuses the field. On `reset` it returns to the initial value.

## Keyboard

| Where | Key | |
|---|---|---|
| Fields | digits | `dd/mm/yyyy` mask; From complete → To |
| | <kbd>↓</kbd> | Opens that field's calendar (or moves into it if already open) |
| | <kbd>⌫</kbd> in empty To | Back to From |
| | <kbd>←</kbd> / <kbd>→</kbd> at the edges | Moves between fields |
| Calendar | arrows, <kbd>Home</kbd>/<kbd>End</kbd> | Day / week |
| | <kbd>PgUp</kbd>/<kbd>PgDn</kbd> | Month |
| | <kbd>Enter</kbd> / <kbd>Space</kbd> | Picks the day |
| | <kbd>Esc</kbd> | Closes |
| Time list | arrows, <kbd>Home</kbd>/<kbd>End</kbd> | Previous / next time, first / last |
| | <kbd>Enter</kbd> / <kbd>Space</kbd> | Picks the time |

## Theming

Every color comes from CSS variables on `.rs`; just override them:

```css
.my-screen .rs {
    --rs-accent: #059669; --rs-accent-dark: #047857;
    --rs-accent-soft: #ecfdf5; --rs-accent-text: #047857;
    --rs-height: 2.5rem; --rs-radius: .375rem;
}
```

### Width

The control has the same width everywhere: `--rs-width` (default `26rem`, enough for
both dates with their labels beside them). In a narrower container it shrinks and the
labels move above the dates, but never below `--rs-min-width` (default `17.5rem`), where
both dates are still fully readable. In a filter grid, give its cell enough room
(e.g. two columns).

```css
.rs { --rs-width: 30rem; --rs-min-width: 18rem; }
```

## Development

```bash
npm test        # node --test: parsing, mask, ranges, presets (pure logic)
npm run demo    # http://localhost:8090 → index.html
```

## License

[MIT](LICENSE)
