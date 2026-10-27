# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## 0.2.0 - 2026-10-26

### Added
- `time` option: `true` adds an optional `hh:mm` to each date (no time means the whole
  day: From 00:00, To 23:59; values are `YYYY-MM-DDTHH:mm`); `'only'` makes it a range
  of hours with no calendar (values are `HH:mm`). `data-time="true"` / `"only"`.
- `step` option (`data-step`): minutes between the times offered in the panel.
- Keyboard navigation in the time list (arrows, <kbd>Home</kbd>/<kbd>End</kbd>).
- English option aliases: `from`, `to`, `nameFrom`, `nameTo`, `empty`, `noLimit`
  (and their `data-*` attributes); presets accept `{ label, from, to }`;
  `open()` accepts `'from'`/`'to'` and `'field'`/`'range'`.
- `getValue()`, `onChange` and the `rangeselector:change` event also carry `from` and `to`.
- Built-in English locale: `locale: 'en'` (or `data-locale="en"`), and
  `{ base: 'en', …overrides }` to change a few texts. `RangeSelector.locales`.
- Locale keys for texts that were hard-coded in Spanish: `formatos` (format in the
  fields' aria-label), `dia` (aria-label of calendar days), `presets` (default preset
  labels), `vacio`, `sinLimite`.
- TypeScript definitions (`src/range-selector.d.ts`).
- MIT license.

### Changed
- `vacio` and `sinLimite` default to `null`, meaning "the locale's text".
- The panel shifts left when it would overflow the right edge of the window.

### Fixed
- A `step` or `months` of 0 or a non-number could hang the page; invalid values now
  fall back to the defaults.
- Options passed as `undefined` overwrote their defaults.
- Calling `destroy()` right after a field lost focus left classes on the element.
- Locale texts were inserted into the calendar HTML without escaping.

## 0.1.0 - 2026-10-11

Initial version.

