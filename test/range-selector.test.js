// Tests for the pure logic (no DOM): `node --test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const RangeSelector = require('../src/range-selector.js');

const { parse, mask, fitsMask, toISO, toDMY, fromISO, normalize, inLimits, pick, defaultPresets } =
    RangeSelector.utils;

const d = (s) => fromISO(s);

test('parse: valid dd/mm/yyyy', () => {
    assert.equal(toISO(parse('01/10/2026')), '2026-10-01');
    assert.equal(toISO(parse(' 29/02/2024 ')), '2024-02-29');
});

test('parse: empty is null, garbage and nonexistent dates are false', () => {
    assert.equal(parse(''), null);
    assert.equal(parse('   '), null);
    assert.equal(parse('31/02/2026'), false);
    assert.equal(parse('29/02/2025'), false);
    assert.equal(parse('1/10/2026'), false);
    assert.equal(parse('01/13/2026'), false);
    assert.equal(parse('01/10/202'), false);
});

test('parse: two-digit year is 20yy', () => {
    assert.equal(toISO(parse('01/10/26')), '2026-10-01');
});

test('mask: inserts the slashes and stops at 8 digits', () => {
    assert.equal(mask('0'), '0');
    assert.equal(mask('01'), '01');
    assert.equal(mask('011'), '01/1');
    assert.equal(mask('0110'), '01/10');
    assert.equal(mask('01102026'), '01/10/2026');
    assert.equal(mask('011020261234'), '01/10/2026');
    assert.equal(mask('01/10/2026'), '01/10/2026');
    assert.equal(mask('ab01c10'), '01/10');
});

test('fitsMask: well-formed, incomplete prefixes', () => {
    assert.equal(fitsMask(''), true);
    assert.equal(fitsMask('01/1'), true);
    assert.equal(fitsMask('01/10/202'), true);
    assert.equal(fitsMask('01/10/2026'), false);   // complete: no guide left to draw
    assert.equal(fitsMask('0a'), false);
    assert.equal(fitsMask('011'), false);           // missing the slash
});

test('toDMY / fromISO round trip', () => {
    assert.equal(toDMY(d('2026-01-05')), '05/01/2026');
    assert.equal(fromISO('2026-02-30'), null);
    assert.equal(fromISO(''), null);
    assert.equal(toISO(fromISO(new Date(2026, 9, 11, 15, 30))), '2026-10-11');
});

test('normalize: swaps if From is after To', () => {
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

test('pick: picking From moves on to To', () => {
    const s = pick({ desde: null, hasta: null, active: 'desde' }, d('2026-10-05'));
    assert.equal(toISO(s.desde), '2026-10-05');
    assert.equal(s.active, 'hasta');
    assert.equal(s.done, false);
});

test('pick: a new From after To discards To', () => {
    const s = pick({ desde: d('2026-10-01'), hasta: d('2026-10-10'), active: 'desde' }, d('2026-10-20'));
    assert.equal(toISO(s.desde), '2026-10-20');
    assert.equal(s.hasta, null);
});

test('pick: To completes the range', () => {
    const s = pick({ desde: d('2026-10-05'), hasta: null, active: 'hasta' }, d('2026-10-12'));
    assert.equal(toISO(s.hasta), '2026-10-12');
    assert.equal(s.done, true);
});

test('pick: a day before From while picking To restarts the range', () => {
    const s = pick({ desde: d('2026-10-05'), hasta: null, active: 'hasta' }, d('2026-10-01'));
    assert.equal(toISO(s.desde), '2026-10-01');
    assert.equal(s.hasta, null);
    assert.equal(s.active, 'hasta');
    assert.equal(s.done, false);
});

test('pick: To alone (open range) also closes', () => {
    const s = pick({ desde: null, hasta: null, active: 'hasta' }, d('2026-10-12'));
    assert.equal(s.desde, null);
    assert.equal(toISO(s.hasta), '2026-10-12');
    assert.equal(s.done, true);
});

test('pick in campo mode: changes only that field and closes', () => {
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

test('selectable: in campo mode days that invert the range are not offered', () => {
    const { selectable } = RangeSelector.utils;
    const st = { desde: d('2026-10-05'), hasta: d('2026-10-20'), mode: 'campo' };
    assert.equal(selectable(d('2026-10-21'), { ...st, active: 'desde' }), false);
    assert.equal(selectable(d('2026-10-20'), { ...st, active: 'desde' }), true);
    assert.equal(selectable(d('2026-10-04'), { ...st, active: 'hasta' }), false);
    assert.equal(selectable(d('2026-10-04'), { ...st, active: 'hasta', mode: 'rango' }), true);
    assert.equal(selectable(d('2025-01-01'), { ...st, active: 'desde' }, d('2026-01-01')), false);
});

test('defaultPresets: week starts on Monday and months are cut correctly', () => {
    const p = Object.fromEntries(defaultPresets(d('2026-10-11')).map((x) => [x.label, x]));  // Sunday
    assert.equal(toISO(p['Esta semana'].desde), '2026-10-05');
    assert.equal(toISO(p['Este mes'].hasta), '2026-10-31');
    assert.equal(toISO(p['Mes anterior'].desde), '2026-09-01');
    assert.equal(toISO(p['Mes anterior'].hasta), '2026-09-30');
    assert.equal(toISO(p['Últimos 7 días'].desde), '2026-10-05');
    assert.equal(toISO(p['Año en curso'].desde), '2026-01-01');
});

/* ---------- time: true (date, optional time) ---------- */

const { MASK_T, GUIDE_T, clock, timeSlots, atTime } = RangeSelector.utils;

test('parse with time: optional hh:mm, without a time From is 00:00 and To 23:59', () => {
    assert.equal(toISO(parse('01/10/2026 08:30', true), true), '2026-10-01T08:30');
    assert.equal(toISO(parse('01/10/2026', true), true), '2026-10-01T00:00');
    assert.equal(toISO(parse('01/10/2026', true, true), true), '2026-10-01T23:59');
    assert.equal(toISO(parse('01/10/26 23:59', true), true), '2026-10-01T23:59');
});

test('parse with time: impossible times and partial formats are false', () => {
    assert.equal(parse('01/10/2026 24:00', true), false);
    assert.equal(parse('01/10/2026 12:60', true), false);
    assert.equal(parse('01/10/2026 8:30', true), false);
    assert.equal(parse('31/02/2026 10:00', true), false);
    // Without `time`, a time is not accepted.
    assert.equal(parse('01/10/2026 08:30'), false);
});

test('mask with time: inserts space and colon, stops at 12 digits', () => {
    assert.equal(mask('011020260', true), '01/10/2026 0');
    assert.equal(mask('0110202608', true), '01/10/2026 08');
    assert.equal(mask('011020260830', true), '01/10/2026 08:30');
    assert.equal(mask('01102026083099', true), '01/10/2026 08:30');
    assert.equal(mask('011020260830'), '01/10/2026');
    assert.equal(MASK_T.length, GUIDE_T.length);
});

test('fitsMask with time', () => {
    assert.equal(fitsMask('01/10/2026 0', true), true);
    assert.equal(fitsMask('01/10/2026', true), true);
    assert.equal(fitsMask('01/10/2026 08:30', true), false);
    assert.equal(fitsMask('01/10/2026x', true), false);
});

test('fromISO with time: accepts with and without THH:mm; Date keeps the time', () => {
    assert.equal(toISO(fromISO('2026-10-01T08:30', true), true), '2026-10-01T08:30');
    assert.equal(toISO(fromISO('2026-10-01', true, true), true), '2026-10-01T23:59');
    assert.equal(fromISO('2026-10-01T25:00', true), null);
    assert.equal(toISO(fromISO(new Date(2026, 9, 1, 14, 5), true), true), '2026-10-01T14:05');
    // Without `time`, the time is dropped.
    assert.equal(toISO(fromISO('2026-10-01T08:30')), '2026-10-01');
    assert.equal(toDMY(fromISO('2026-10-01T08:30', true), true), '01/10/2026 08:30');
});

test('selectable with time: compares by day', () => {
    const { selectable } = RangeSelector.utils;
    const st = { desde: fromISO('2026-10-05T18:00', true), hasta: fromISO('2026-10-20T09:00', true), mode: 'campo' };
    assert.equal(selectable(d('2026-10-20'), { ...st, active: 'desde' }), true);
    assert.equal(selectable(d('2026-10-05'), { ...st, active: 'hasta' }), true);
    assert.equal(selectable(d('2026-10-01'), { ...st, active: 'desde' }, fromISO('2026-10-01T12:00', true)), true);
});

test('atTime: day with another date\'s time or the edge time', () => {
    assert.equal(toISO(atTime(d('2026-10-03'), fromISO('2026-01-01T07:15', true)), true), '2026-10-03T07:15');
    assert.equal(toISO(atTime(d('2026-10-03'), null, true), true), '2026-10-03T23:59');
    assert.equal(atTime(null), null);
});

test('timeSlots: no date means no times; on the same day the range is not inverted', () => {
    assert.ok(timeSlots({ desde: null, hasta: null, active: 'desde' }, 60).every((t) => !t.enabled));
    const st = { desde: fromISO('2026-10-05T10:00', true), hasta: fromISO('2026-10-05T18:00', true) };
    const desde = timeSlots({ ...st, active: 'desde' }, 60);
    assert.equal(desde.length, 24);
    assert.equal(desde[10].on, true);
    assert.equal(desde[18].enabled, true);
    assert.equal(desde[19].enabled, false);
    const hasta = timeSlots({ ...st, active: 'hasta' }, 60);
    assert.equal(hasta[9].enabled, false);
    assert.equal(hasta[10].enabled, true);
    // Different day: everything is allowed.
    const otro = timeSlots({ desde: st.desde, hasta: fromISO('2026-10-06T08:00', true), active: 'desde' }, 60);
    assert.ok(otro.every((t) => t.enabled));
});

test('timeSlots: respects min/max with time', () => {
    const st = { desde: fromISO('2026-10-05T10:00', true), hasta: null, active: 'desde' };
    const s = timeSlots(st, 30, fromISO('2026-10-05T09:00', true), null);
    assert.equal(s[17].enabled, false);  // 08:30
    assert.equal(s[18].enabled, true);   // 09:00
});

/* ---------- time: 'only' (time only) ---------- */

test("parse/mask/toISO time only", () => {
    assert.equal(toISO(parse('08:30', 'only'), 'only'), '08:30');
    assert.equal(parse('', 'only'), null);
    assert.equal(parse('24:00', 'only'), false);
    assert.equal(parse('8:30', 'only'), false);
    assert.equal(parse('01/10/2026', 'only'), false);
    assert.equal(mask('0', 'only'), '0');
    assert.equal(mask('083', 'only'), '08:3');
    assert.equal(mask('083099', 'only'), '08:30');
    assert.equal(fitsMask('08:', 'only'), true);
    assert.equal(fitsMask('08:30', 'only'), false);
    assert.equal(toDMY(parse('18:05', 'only'), 'only'), '18:05');
});

test("fromISO time only: 'HH:mm' or Date, always on the same fixed day", () => {
    assert.equal(toISO(fromISO('07:45', 'only'), 'only'), '07:45');
    assert.equal(fromISO('2026-10-01', 'only'), null);
    assert.equal(fromISO('25:00', 'only'), null);
    const a = fromISO(new Date(2026, 9, 1, 9, 0), 'only'), b = fromISO('09:00', 'only');
    assert.equal(a.getTime(), b.getTime());
    assert.equal(a.getTime(), clock(9, 0).getTime());
});

test('time only: normalize and pick work the same as with days', () => {
    const n = normalize(fromISO('18:00', 'only'), fromISO('09:00', 'only'));
    assert.deepEqual(n.map((x) => toISO(x, 'only')), ['09:00', '18:00']);
    const s = pick({ desde: fromISO('09:00', 'only'), hasta: null, active: 'hasta' }, fromISO('17:30', 'only'));
    assert.equal(toISO(s.hasta, 'only'), '17:30');
    assert.equal(s.done, true);
});

test('timeSlots time only: with `base` there are times even if the field is empty; `free` does not block', () => {
    const empty = timeSlots({ desde: null, hasta: null, active: 'desde' }, 60, null, null, clock());
    assert.ok(empty.every((t) => t.enabled));
    const st = { desde: null, hasta: fromISO('12:00', 'only'), active: 'desde' };
    assert.equal(timeSlots(st, 60, null, null, clock())[13].enabled, false);
    assert.equal(timeSlots({ ...st, free: true }, 60, null, null, clock())[13].enabled, true);
});

test('defaultPresets: locale texts, missing ones in Spanish', () => {
    const p = defaultPresets(d('2026-10-11'), { hoy: 'Today', ayer: 'Yesterday' }).map((x) => x.label);
    assert.equal(p[0], 'Today');
    assert.equal(p[1], 'Yesterday');
    assert.equal(p[2], 'Esta semana');
});
