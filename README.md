# RangeSelector

Selector de rango de fechas **Desde → Hasta**, sin dependencias.

```
┌──────────────────────────────────────────────────┬────┐
│ DESDE  01/10/2026     →     HASTA  __/__/____    │ 📅 │
└──────────────────────────────────────────────────┴────┘
```

- **Dos inputs tipeables con máscara** (`dd/mm/aaaa`) dentro de un mismo control.
  La guía `__/__/____` se completa a medida que se tipea; al completar Desde salta
  solo a Hasta. Año de dos dígitos → `20aa`.
- **Click en un campo**: abre el calendario de esa fecha. Se elige el día, cambia
  sólo ese campo y se cierra. Los días que invertirían el rango no se ofrecen.
  El foco queda en el campo, así que también se puede tipear.
- **Botón 📅**: abre el calendario de rango. Primero Desde, después Hasta; un día
  anterior a Desde reinicia el rango ahí.
- **Rangos abiertos**: sólo Desde o sólo Hasta es válido (el lado vacío dice «Sin límite»).
- **Vacío con significado**: sin fechas, el control dice qué pasa («Todas las fechas»,
  «Este mes»…) y el botón izquierdo del panel vuelve a ese estado.
- Atajos (Hoy, Ayer, Esta semana, Últimos 7/30 días, Este mes, Mes anterior, Año en curso),
  límites `min`/`max`, validación (31/02, fuera de rango) que bloquea el submit, Desde
  posterior a Hasta se invierten, teclado completo, ARIA.
- Viajan dos `<input type="hidden">` con las fechas en ISO (`AAAA-MM-DD`).

## Uso

```html
<link rel="stylesheet" href="src/range-selector.css">

<span id="lbl">Fecha</span>
<div data-range-selector
     data-name-desde="desde" data-name-hasta="hasta"
     data-desde="2026-10-01" data-hasta="2026-10-11"
     data-vacio="Todas las fechas"
     aria-labelledby="lbl"></div>

<script src="src/range-selector.js"></script>   <!-- auto-inicializa [data-range-selector] -->
```

O por JS:

```js
const rs = new RangeSelector('#periodo', {
    nameDesde: 'desde', nameHasta: 'hasta',
    min: '2025-01-01', max: new Date(),
    vacio: 'Este mes',
    onChange: ({ desde, hasta }) => console.log(desde, hasta),
});
```

## Opciones

| Opción        | data-attribute       | Default              | |
|---------------|----------------------|----------------------|---|
| `nameDesde`   | `data-name-desde`    | `'desde'`            | `name` del hidden de Desde |
| `nameHasta`   | `data-name-hasta`    | `'hasta'`            | `name` del hidden de Hasta |
| `desde`       | `data-desde`         | `null`               | Valor inicial (`'AAAA-MM-DD'` o `Date`) |
| `hasta`       | `data-hasta`         | `null`               | |
| `min` / `max` | `data-min` / `data-max` | `null`            | Límites; afuera se deshabilita en el calendario y es error al tipear |
| `vacio`       | `data-vacio`         | `'Todas las fechas'` | Qué significa no elegir rango (texto del control vacío y del botón que lo vacía) |
| `sinLimite`   | `data-sin-limite`    | `'Sin límite'`       | Lado vacío de un rango abierto |
| `presets`     | `data-presets="false"` | `true`             | `true`, `false` o `[{ label, desde, hasta }]` |
| `months`      | `data-months`        | `2`                  | Meses visibles en el calendario (en mobile siempre 1) |
| `autoAdvance` | `data-auto-advance="false"` | `true`        | Saltar a Hasta al completar Desde |
| `onChange`    | —                    | `null`               | `fn({ desde, hasta })` en ISO |
| `locale`      | —                    | español              | Textos y nombres de meses/días (ver `RangeSelector.locale`) |

## Métodos

| | |
|---|---|
| `getValue()` | `{ desde: 'AAAA-MM-DD' \| '', hasta: … }` |
| `setValue(desde, hasta)` | ISO, `Date` o `null` |
| `clear()` | Vacía el rango |
| `setLimits(min, max)` | Cambia los límites (revalida lo tipeado) |
| `validate()` | Interpreta lo tipeado; `false` si hay errores |
| `open(campo?, modo?)` / `close()` / `isOpen()` | Panel; `campo` = `'desde'` \| `'hasta'`, `modo` = `'rango'` (default) \| `'campo'` |
| `destroy()` | Saca listeners y markup |
| `RangeSelector.init(scope?)` | Inicializa los `[data-range-selector]` de `scope` (lo hace solo al cargar) |
| `RangeSelector.utils` | Funciones puras: `parse`, `mask`, `toISO`, `toDMY`, `fromISO`, `pick`… |

## Eventos

- `rangeselector:change` (burbujea) — `event.detail = { desde, hasta }` en ISO, cada vez
  que cambian los hidden.
- Dentro de un `<form>`: en el `submit` interpreta lo tipeado y, si hay una fecha inválida,
  cancela el envío y enfoca el campo. En el `reset` vuelve al valor inicial.

## Teclado

| Dónde | Tecla | |
|---|---|---|
| Campos | dígitos | Máscara `dd/mm/aaaa`; Desde completo → Hasta |
| | <kbd>↓</kbd> | Abre el calendario de ese campo (o entra en él si ya está abierto) |
| | <kbd>⌫</kbd> en Hasta vacío | Vuelve a Desde |
| | <kbd>←</kbd> / <kbd>→</kbd> en los bordes | Pasa de un campo al otro |
| Calendario | flechas, <kbd>Inicio</kbd>/<kbd>Fin</kbd> | Día / semana |
| | <kbd>RePág</kbd>/<kbd>AvPág</kbd> | Mes |
| | <kbd>Enter</kbd> / <kbd>Espacio</kbd> | Elige el día |
| | <kbd>Esc</kbd> | Cierra |

## Tema

Todo color sale de variables CSS en `.rs`; alcanza con pisarlas:

```css
.mi-pantalla .rs {
    --rs-accent: #059669; --rs-accent-dark: #047857;
    --rs-accent-soft: #ecfdf5; --rs-accent-text: #047857;
    --rs-height: 2.5rem; --rs-radius: .375rem;
}
```

## Desarrollo

```bash
npm test        # node --test: parseo, máscara, rangos, atajos (lógica pura)
npm run demo    # http://localhost:8090 → index.html
```
