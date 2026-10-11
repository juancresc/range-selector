# RangeSelector

The usability-first date picker. A **From → To** date range selector with no dependencies.

**[Live demo & playground →](https://juancresc.github.io/range-selector/)**

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
- Submits two `<input type="hidden">` with the dates in ISO (`YYYY-MM-DD`).

> The component's default UI texts are in Spanish; override them with the `locale` option.

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

## Options

| Option        | data-attribute       | Default              | |
|---------------|----------------------|----------------------|---|
| `nameDesde`   | `data-name-desde`    | `'desde'`            | `name` of the From hidden input |
| `nameHasta`   | `data-name-hasta`    | `'hasta'`            | `name` of the To hidden input |
| `desde`       | `data-desde`         | `null`               | Initial From value (`'YYYY-MM-DD'` or `Date`) |
| `hasta`       | `data-hasta`         | `null`               | Initial To value |
| `min` / `max` | `data-min` / `data-max` | `null`            | Limits; outside them, days are disabled in the calendar and typing them is an error |
| `vacio`       | `data-vacio`         | `'Todas las fechas'` | What choosing no range means (text of the empty control and of the button that clears it) |
| `sinLimite`   | `data-sin-limite`    | `'Sin límite'`       | Empty side of an open range |
| `presets`     | `data-presets="false"` | `true`             | `true`, `false` or `[{ label, desde, hasta }]` |
| `months`      | `data-months`        | `2`                  | Months visible in the calendar (always 1 on mobile) |
| `autoAdvance` | `data-auto-advance="false"` | `true`        | Jump to To when From is complete |
| `onChange`    | —                    | `null`               | `fn({ desde, hasta })` in ISO |
| `locale`      | —                    | Spanish              | Texts and month/day names (see `RangeSelector.locale`) |

## Methods

| | |
|---|---|
| `getValue()` | `{ desde: 'YYYY-MM-DD' \| '', hasta: … }` |
| `setValue(desde, hasta)` | ISO, `Date` or `null` |
| `clear()` | Clears the range |
| `setLimits(min, max)` | Changes the limits (revalidates typed input) |
| `validate()` | Parses typed input; `false` if there are errors |
| `open(campo?, modo?)` / `close()` / `isOpen()` | Panel; `campo` = `'desde'` \| `'hasta'`, `modo` = `'rango'` (default) \| `'campo'` |
| `destroy()` | Removes listeners and markup |
| `RangeSelector.init(scope?)` | Initializes the `[data-range-selector]` elements in `scope` (runs automatically on load) |
| `RangeSelector.utils` | Pure functions: `parse`, `mask`, `toISO`, `toDMY`, `fromISO`, `pick`… |

## Events

- `rangeselector:change` (bubbles) — `event.detail = { desde, hasta }` in ISO, every time
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

## Theming

Every color comes from CSS variables on `.rs`; just override them:

```css
.my-screen .rs {
    --rs-accent: #059669; --rs-accent-dark: #047857;
    --rs-accent-soft: #ecfdf5; --rs-accent-text: #047857;
    --rs-height: 2.5rem; --rs-radius: .375rem;
}
```

## Development

```bash
npm test        # node --test: parsing, mask, ranges, presets (pure logic)
npm run demo    # http://localhost:8090 → index.html
```
