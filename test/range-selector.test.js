// Tests de la lógica pura (sin DOM): `node --test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const RangeSelector = require('../src/range-selector.js');

const { parse, mask, fitsMask, toISO, toDMY, fromISO, normalize, inLimits, pick, defaultPresets } =
    RangeSelector.utils;

const d = (s) => fromISO(s);

test('parse: dd/mm/aaaa válida', () => {
    assert.equal(toISO(parse('01/10/2026')), '2026-10-01');
    assert.equal(toISO(parse(' 29/02/2024 ')), '2024-02-29');
});

test('parse: vacío es null, basura e inexistentes son false', () => {
    assert.equal(parse(''), null);
    assert.equal(parse('   '), null);
    assert.equal(parse('31/02/2026'), false);
    assert.equal(parse('29/02/2025'), false);
    assert.equal(parse('1/10/2026'), false);
    assert.equal(parse('01/13/2026'), false);
    assert.equal(parse('01/10/202'), false);
});

test('parse: año de dos dígitos es 20aa', () => {
    assert.equal(toISO(parse('01/10/26')), '2026-10-01');
});

test('mask: inserta las barras y corta en 8 dígitos', () => {
    assert.equal(mask('0'), '0');
    assert.equal(mask('01'), '01');
    assert.equal(mask('011'), '01/1');
    assert.equal(mask('0110'), '01/10');
    assert.equal(mask('01102026'), '01/10/2026');
    assert.equal(mask('011020261234'), '01/10/2026');
    assert.equal(mask('01/10/2026'), '01/10/2026');
    assert.equal(mask('ab01c10'), '01/10');
});

test('fitsMask: prefijos bien formados e incompletos', () => {
    assert.equal(fitsMask(''), true);
    assert.equal(fitsMask('01/1'), true);
    assert.equal(fitsMask('01/10/202'), true);
    assert.equal(fitsMask('01/10/2026'), false);   // completo: no hay guía que dibujar
    assert.equal(fitsMask('0a'), false);
    assert.equal(fitsMask('011'), false);           // falta la barra
});

test('toDMY / fromISO ida y vuelta', () => {
    assert.equal(toDMY(d('2026-01-05')), '05/01/2026');
    assert.equal(fromISO('2026-02-30'), null);
    assert.equal(fromISO(''), null);
    assert.equal(toISO(fromISO(new Date(2026, 9, 11, 15, 30))), '2026-10-11');
});

test('normalize: invierte si Desde es posterior a Hasta', () => {
    const [a, b] = normalize(d('2026-10-20'), d('2026-10-01'));
    assert.equal(toISO(a), '2026-10-01');
    assert.equal(toISO(b), '2026-10-20');
    const [c, e] = normalize(d('2026-10-01'), null);
    assert.equal(toISO(c), '2026-10-01');
    assert.equal(e, null);
});

test('inLimits', () => {
    const min = d('2026-01-01'), max = d('2026-12-31');
    assert.equal(inLimits(d('2026-06-01'), min, max), true);
    assert.equal(inLimits(d('2025-12-31'), min, max), false);
    assert.equal(inLimits(d('2027-01-01'), min, max), false);
    assert.equal(inLimits(null, min, max), true);
    assert.equal(inLimits(d('1990-01-01'), null, null), true);
});

test('pick: elegir Desde pasa a Hasta', () => {
    const s = pick({ desde: null, hasta: null, active: 'desde' }, d('2026-10-05'));
    assert.equal(toISO(s.desde), '2026-10-05');
    assert.equal(s.active, 'hasta');
    assert.equal(s.done, false);
});

test('pick: Desde nuevo posterior a Hasta descarta Hasta', () => {
    const s = pick({ desde: d('2026-10-01'), hasta: d('2026-10-10'), active: 'desde' }, d('2026-10-20'));
    assert.equal(toISO(s.desde), '2026-10-20');
    assert.equal(s.hasta, null);
});

test('pick: Hasta completa el rango', () => {
    const s = pick({ desde: d('2026-10-05'), hasta: null, active: 'hasta' }, d('2026-10-12'));
    assert.equal(toISO(s.hasta), '2026-10-12');
    assert.equal(s.done, true);
});

test('pick: un día anterior a Desde mientras se elige Hasta reinicia el rango', () => {
    const s = pick({ desde: d('2026-10-05'), hasta: null, active: 'hasta' }, d('2026-10-01'));
    assert.equal(toISO(s.desde), '2026-10-01');
    assert.equal(s.hasta, null);
    assert.equal(s.active, 'hasta');
    assert.equal(s.done, false);
});

test('pick: sólo Hasta (rango abierto) también cierra', () => {
    const s = pick({ desde: null, hasta: null, active: 'hasta' }, d('2026-10-12'));
    assert.equal(s.desde, null);
    assert.equal(toISO(s.hasta), '2026-10-12');
    assert.equal(s.done, true);
});

test('pick modo campo: cambia sólo ese campo y cierra', () => {
    const base = { desde: d('2026-10-05'), hasta: d('2026-10-20'), mode: 'campo' };
    const a = pick({ ...base, active: 'desde' }, d('2026-10-01'));
    assert.equal(toISO(a.desde), '2026-10-01');
    assert.equal(toISO(a.hasta), '2026-10-20');
    assert.equal(a.done, true);
    const b = pick({ ...base, active: 'hasta' }, d('2026-10-25'));
    assert.equal(toISO(b.desde), '2026-10-05');
    assert.equal(toISO(b.hasta), '2026-10-25');
    assert.equal(b.done, true);
});

test('selectable: en modo campo no se ofrecen días que invierten el rango', () => {
    const { selectable } = RangeSelector.utils;
    const st = { desde: d('2026-10-05'), hasta: d('2026-10-20'), mode: 'campo' };
    assert.equal(selectable(d('2026-10-21'), { ...st, active: 'desde' }), false);
    assert.equal(selectable(d('2026-10-20'), { ...st, active: 'desde' }), true);
    assert.equal(selectable(d('2026-10-04'), { ...st, active: 'hasta' }), false);
    assert.equal(selectable(d('2026-10-04'), { ...st, active: 'hasta', mode: 'rango' }), true);
    assert.equal(selectable(d('2025-01-01'), { ...st, active: 'desde' }, d('2026-01-01')), false);
});

test('defaultPresets: semana arranca el lunes y meses bien cortados', () => {
    const p = Object.fromEntries(defaultPresets(d('2026-10-11')).map((x) => [x.label, x]));  // domingo
    assert.equal(toISO(p['Esta semana'].desde), '2026-10-05');
    assert.equal(toISO(p['Este mes'].hasta), '2026-10-31');
    assert.equal(toISO(p['Mes anterior'].desde), '2026-09-01');
    assert.equal(toISO(p['Mes anterior'].hasta), '2026-09-30');
    assert.equal(toISO(p['Últimos 7 días'].desde), '2026-10-05');
    assert.equal(toISO(p['Año en curso'].desde), '2026-01-01');
});
