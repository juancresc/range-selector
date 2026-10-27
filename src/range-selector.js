/*!
 * RangeSelector — a «From → To» date range picker.
 *
 * Two typeable masked inputs (dd/mm/yyyy) inside a single control, plus a
 * two-month calendar behind a button. No dependencies.
 *
 *   <div data-range-selector data-name-desde="desde" data-name-hasta="hasta"></div>
 *   <script src="range-selector.js"></script>   (auto-initializes [data-range-selector])
 *
 *   const rs = new RangeSelector(el, { vacio: 'Este mes', min: '2026-01-01' });
 *   rs.getValue()  // { desde: '2026-10-01', hasta: '2026-10-11' }
 *
 * See README.md for options, methods and events.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.RangeSelector = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* =====================================================================
     * Pure utilities (no DOM): exported as RangeSelector.utils and tested.
     * All dates are Dates at local midnight. `time` changes the format:
     *   false   date only               dd/mm/yyyy         'YYYY-MM-DD'
     *   true    date, optional time     dd/mm/yyyy hh:mm   'YYYY-MM-DDTHH:mm'
     *           (From without a time is 00:00, To without a time is 23:59)
     *   'only'  time only               hh:mm              'HH:mm'
     *           (the Date is that time on a fixed day, see `clock`)
     * ===================================================================== */

    var MASK = '##/##/####';
    var GUIDE = '__/__/____';
    var MASK_T = '##/##/#### ##:##';
    var GUIDE_T = '__/__/____ __:__';
    var MASK_H = '##:##';
    var GUIDE_H = '__:__';
    function maskFor(time) { return time === 'only' ? MASK_H : time ? MASK_T : MASK; }
    function guideFor(time) { return time === 'only' ? GUIDE_H : time ? GUIDE_T : GUIDE; }

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function ymd(y, m, d) { return new Date(y, m, d); }
    function today() { var d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }
    function addDays(d, n) { return ymd(d.getFullYear(), d.getMonth(), d.getDate() + n); }
    function addMonths(d, n) { return ymd(d.getFullYear(), d.getMonth() + n, 1); }
    function startOfMonth(d) { return ymd(d.getFullYear(), d.getMonth(), 1); }
    function same(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
    function dayOf(d) { return d ? ymd(d.getFullYear(), d.getMonth(), d.getDate()) : null; }
    function sameDay(a, b) { return same(dayOf(a), dayOf(b)); }
    // Fixed day for bare times (`time: 'only'`), so they compare like any other Date.
    function clock(h, min) { return new Date(2000, 0, 1, h || 0, min || 0); }

    /* Day `day` with the time of `ref`; without `ref`, the edge of the day
       (From 00:00, To 23:59). */
    function atTime(day, ref, isHasta) {
        var d = dayOf(day);
        if (!d) return null;
        if (ref) d.setHours(ref.getHours(), ref.getMinutes());
        else if (isHasta) d.setHours(23, 59);
        return d;
    }

    // A real date or null: 31/02 doesn't exist.
    function real(y, m, d) {
        var dt = ymd(y, m - 1, d);
        return (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) ? dt : null;
    }
    function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function toISO(d, time) {
        if (!d) return '';
        if (time === 'only') return hm(d);
        var s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        return time ? s + 'T' + hm(d) : s;
    }
    function toDMY(d, time) {
        if (!d) return '';
        if (time === 'only') return hm(d);
        var s = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
        return time ? s + ' ' + hm(d) : s;
    }
    // With a valid hh:mm time, the day at that time; otherwise null.
    function withHM(d, h, min) {
        if (!d || h > 23 || min > 59) return null;
        d.setHours(h, min);
        return d;
    }
    /* 'YYYY-MM-DD' (or 'YYYY-MM-DDTHH:mm' with `time`, or 'HH:mm' with 'only') or
       Date → Date or null. Without `time` the time is dropped. */
    function fromISO(s, time, isHasta) {
        if (time === 'only') {
            if (s instanceof Date) return clock(s.getHours(), s.getMinutes());
            var h = /^(\d{2}):(\d{2})$/.exec(s || '');
            return h ? withHM(clock(), +h[1], +h[2]) : null;
        }
        if (s instanceof Date) return time ? new Date(s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes()) : dayOf(s);
        var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s || '');
        if (!m) return null;
        var d = real(+m[1], +m[2], +m[3]);
        if (!time || !d) return d;
        return m[4] != null ? withHM(d, +m[4], +m[5]) : atTime(d, null, isHasta);
    }

    /* Input text → Date, null (empty) or false (invalid).
     * Accepts dd/mm/yyyy and dd/mm/yy (a short year is 20yy). With `time` it also
     * accepts « hh:mm»; without a time, From is 00:00 and To (`isHasta`) 23:59. */
    function parse(s, time, isHasta) {
        s = (s || '').trim();
        if (!s) return null;
        if (time === 'only') {
            var h = /^(\d{2}):(\d{2})$/.exec(s);
            return (h && withHM(clock(), +h[1], +h[2])) || false;
        }
        var m = time
            ? /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})(?: (\d{2}):(\d{2}))?$/.exec(s)
            : /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(s);
        if (!m) return false;
        var y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
        var d = real(y, +m[2], +m[1]);
        if (!d || !time) return d || false;
        return (m[4] != null ? withHM(d, +m[4], +m[5]) : atTime(d, null, isHasta)) || false;
    }

    /* Typing guide: builds "dd/mm/yyyy" ("dd/mm/yyyy hh:mm" or "hh:mm" depending
       on `time`) from the digits, inserting the slashes, the space and the colon. */
    function mask(v, time) {
        var M = maskFor(time);
        var digits = String(v || '').replace(/\D/g, '').slice(0, M.split('#').length - 1), out = '', di = 0;
        for (var i = 0; i < M.length && di < digits.length; i++) {
            out += M[i] === '#' ? digits[di++] : M[i];
        }
        return out;
    }

    // Is `v` a well-formed, incomplete prefix of the mask? (then the rest of the guide is drawn)
    function fitsMask(v, time) {
        var M = maskFor(time);
        if (v.length >= M.length) return false;
        for (var i = 0; i < v.length; i++) {
            if (M[i] === '#' ? !/\d/.test(v[i]) : v[i] !== M[i]) return false;
        }
        return true;
    }

    // From after To: they get swapped.
    function normalize(desde, hasta) {
        return (desde && hasta && desde > hasta) ? [hasta, desde] : [desde, hasta];
    }

    function inLimits(d, min, max) { return !d || ((!min || d >= min) && (!max || d <= max)); }

    /* Can day `d` be picked? Besides min/max, when picking a single field
       ('campo' (field) mode) days that would put From after To aren't offered. */
    function selectable(d, state, min, max) {
        // Compared by day: with a time, the limit's day or the other end's day can be picked.
        if (!inLimits(d, dayOf(min), dayOf(max))) return false;
        if (state.mode !== 'campo') return true;
        if (state.active === 'desde' && state.hasta && d > dayOf(state.hasta)) return false;
        if (state.active === 'hasta' && state.desde && d < dayOf(state.desde)) return false;
        return true;
    }

    /* Times every `step` minutes for the `active` field, flagging which can be
       picked: within min/max and without inverting the range on the same day (except
       with `state.free`, picking a range of times in one pass, like `pick`).
       With no date in the field no time is possible, unless `base` is given. */
    function timeSlots(state, step, min, max, base) {
        var cur = state[state.active], other = state.active === 'desde' ? state.hasta : state.desde, out = [];
        for (var t = 0; t < 24 * 60; t += step) {
            var ref = cur || base, d = ref ? atTime(ref, null) : null, ok = !!d;
            if (d) {
                d.setHours(Math.floor(t / 60), t % 60);
                if (!inLimits(d, min, max)) ok = false;
                if (!state.free && other && sameDay(d, other) && (state.active === 'desde' ? d > other : d < other)) ok = false;
            }
            out.push({ label: pad(Math.floor(t / 60)) + ':' + pad(t % 60), minutes: t, date: d, enabled: ok,
                       on: !!cur && cur.getHours() * 60 + cur.getMinutes() === t });
        }
        return out;
    }

    /* What happens when picking day `d` in the calendar with field `active`.
     * `state.mode`:
     *   'rango' (range; calendar button): From and then To, in one pass.
     *   'campo' (field; click on a field): only that field changes, then it closes.
     * Returns the new state: { desde, hasta, active, done }. `done` = finished,
     * the panel can close. */
    function pick(state, d) {
        var desde = state.desde, hasta = state.hasta;
        if (state.mode === 'campo') {
            // In this mode days that would invert the range are disabled
            // (see `selectable`); normalize anyway, just in case.
            var n = normalize(state.active === 'desde' ? d : desde, state.active === 'hasta' ? d : hasta);
            return { desde: n[0], hasta: n[1], active: state.active, done: true };
        }
        if (state.active === 'desde') {
            return { desde: d, hasta: (hasta && hasta < d) ? null : hasta, active: 'hasta', done: false };
        }
        if (desde && d < desde) {
            // A day before From while picking To: the range starts there.
            return { desde: d, hasta: hasta, active: 'hasta', done: false };
        }
        return { desde: desde, hasta: d, active: 'hasta', done: true };
    }

    var PRESET_LABELS = {
        hoy: 'Hoy', ayer: 'Ayer', estaSemana: 'Esta semana', ultimos7: 'Últimos 7 días',
        ultimos30: 'Últimos 30 días', esteMes: 'Este mes', mesAnterior: 'Mes anterior', anioEnCurso: 'Año en curso',
    };

    // `labels`: preset texts (locale.presets); missing ones fall back to Spanish.
    function defaultPresets(t, labels) {
        t = t || today();
        var L = Object.assign({}, PRESET_LABELS, labels || {});
        var lunes = addDays(t, -((t.getDay() + 6) % 7));
        return [
            { label: L.hoy, desde: t, hasta: t },
            { label: L.ayer, desde: addDays(t, -1), hasta: addDays(t, -1) },
            { label: L.estaSemana, desde: lunes, hasta: t },
            { label: L.ultimos7, desde: addDays(t, -6), hasta: t },
            { label: L.ultimos30, desde: addDays(t, -29), hasta: t },
            { label: L.esteMes, desde: ymd(t.getFullYear(), t.getMonth(), 1), hasta: ymd(t.getFullYear(), t.getMonth() + 1, 0) },
            { label: L.mesAnterior, desde: ymd(t.getFullYear(), t.getMonth() - 1, 1), hasta: ymd(t.getFullYear(), t.getMonth(), 0) },
            { label: L.anioEnCurso, desde: ymd(t.getFullYear(), 0, 1), hasta: t },
        ];
    }

    var utils = {
        MASK: MASK, GUIDE: GUIDE, MASK_T: MASK_T, GUIDE_T: GUIDE_T, MASK_H: MASK_H, GUIDE_H: GUIDE_H,
        maskFor: maskFor, guideFor: guideFor, clock: clock, parse: parse, mask: mask, fitsMask: fitsMask,
        toISO: toISO, toDMY: toDMY, fromISO: fromISO, normalize: normalize, dayOf: dayOf, atTime: atTime,
        inLimits: inLimits, selectable: selectable, timeSlots: timeSlots, pick: pick, defaultPresets: defaultPresets, today: today,
    };

    /* =====================================================================
     * Component
     * ===================================================================== */

    var LOCALE = {
        months: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
                 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
        weekdays: ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'],
        desde: 'Desde',
        hasta: 'Hasta',
        listo: 'Listo',
        elegir: 'Eligiendo',
        abrir: 'Abrir calendario',
        cerrar: 'Cerrar calendario',
        mesAnterior: 'Mes anterior',
        mesSiguiente: 'Mes siguiente',
        invalida: 'Fecha inválida: usá dd/mm/aaaa.',
        invalidaHora: 'Fecha inválida: usá dd/mm/aaaa hh:mm.',
        invalidaSoloHora: 'Hora inválida: usá hh:mm.',
        hora: 'Hora',
        abrirHoras: 'Abrir horarios',
        cerrarHoras: 'Cerrar horarios',
        todoElDia: 'Todo el día',
        vacio: 'Todas las fechas',
        sinLimite: 'Sin límite',
        fueraDeRango: 'Fuera del rango permitido',
        // Format announced in each field's aria-label, depending on `time`.
        formatos: { 'false': 'dd/mm/aaaa', 'true': 'dd/mm/aaaa hh:mm', 'only': 'hh:mm' },
        // aria-label for each calendar day.
        dia: function (d, months) { return d.getDate() + ' de ' + months[d.getMonth()] + ' de ' + d.getFullYear(); },
        presets: PRESET_LABELS,
    };

    var LOCALE_EN = {
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                 'August', 'September', 'October', 'November', 'December'],
        weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
        desde: 'From',
        hasta: 'To',
        listo: 'Done',
        elegir: 'Picking',
        abrir: 'Open calendar',
        cerrar: 'Close calendar',
        mesAnterior: 'Previous month',
        mesSiguiente: 'Next month',
        invalida: 'Invalid date: use dd/mm/yyyy.',
        invalidaHora: 'Invalid date: use dd/mm/yyyy hh:mm.',
        invalidaSoloHora: 'Invalid time: use hh:mm.',
        hora: 'Time',
        abrirHoras: 'Open times',
        cerrarHoras: 'Close times',
        todoElDia: 'All day',
        vacio: 'All dates',
        sinLimite: 'No limit',
        fueraDeRango: 'Outside the allowed range',
        formatos: { 'false': 'dd/mm/yyyy', 'true': 'dd/mm/yyyy hh:mm', 'only': 'hh:mm' },
        dia: function (d, months) { return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); },
        presets: {
            hoy: 'Today', ayer: 'Yesterday', estaSemana: 'This week', ultimos7: 'Last 7 days',
            ultimos30: 'Last 30 days', esteMes: 'This month', mesAnterior: 'Last month', anioEnCurso: 'Year to date',
        },
    };

    var LOCALES = { es: LOCALE, en: LOCALE_EN };

    // English names for the options (and their data-*): equivalent to the originals.
    var ALIASES = { from: 'desde', to: 'hasta', nameFrom: 'nameDesde', nameTo: 'nameHasta', empty: 'vacio', noLimit: 'sinLimite' };

    var DEFAULTS = {
        nameDesde: 'desde',
        nameHasta: 'hasta',
        desde: null,              // 'YYYY-MM-DD' | Date
        hasta: null,
        min: null,
        max: null,
        vacio: null,              // what an empty range means (and the label of the button that clears it); null: the locale's
        sinLimite: null,          // the empty side of an open range; null: the locale's
        presets: true,            // true (the built-in ones) | false | [{label, desde, hasta}]
        months: 2,
        autoAdvance: true,        // From complete → jump to To
        time: false,              // false (date only) | true (date, optional time) | 'only' (time only)
        step: 30,                 // minutes between the panel's times (with `time`)
        onChange: null,           // fn({desde, hasta, from, to}) in ISO
        locale: 'es',             // 'es' | 'en' | object with the texts to override (on top of Spanish)
    };

    var ICON = {
        clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
        right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    };

    var FIELDS = ['desde', 'hasta'];
    var uid = 0;

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    // Element's data-* → options (data-name-desde → nameDesde, etc.).
    function optionsFromData(el) {
        var d = el.dataset, o = {};
        ['nameDesde', 'nameHasta', 'desde', 'hasta', 'min', 'max', 'vacio', 'sinLimite', 'locale']
            .concat(Object.keys(ALIASES)).forEach(function (k) {
                if (d[k] !== undefined && d[k] !== '') o[k] = d[k];
            });
        if (d.presets === 'false') o.presets = false;
        if (d.months) o.months = +d.months;
        if (d.autoAdvance === 'false') o.autoAdvance = false;
        if (d.time === 'true' || d.time === 'only') o.time = d.time === 'only' ? 'only' : true;
        if (d.step) o.step = +d.step;
        return o;
    }

    /* 'es' | 'en' | object → full locale. An object overrides only the texts it
       carries, on top of Spanish (or of `base`: { base: 'en', listo: 'OK' }). */
    function resolveLocale(l) {
        if (typeof l === 'string') l = { base: l };
        l = l || {};
        var base = LOCALES[l.base] || LOCALE;
        var out = Object.assign({}, base, l);
        out.formatos = Object.assign({}, base.formatos, l.formatos);
        out.presets = Object.assign({}, base.presets, l.presets);
        delete out.base;
        return out;
    }

    function RangeSelector(el, options) {
        if (!(this instanceof RangeSelector)) return new RangeSelector(el, options);
        if (typeof el === 'string') el = document.querySelector(el);
        if (!el) throw new Error('RangeSelector: element not found.');
        if (el.rangeSelector) return el.rangeSelector;

        var o = {}, k;
        for (k in DEFAULTS) o[k] = DEFAULTS[k];
        // data-* and then JS; `undefined` overrides nothing: { vacio: undefined } is the same as omitting it.
        [optionsFromData(el), options || {}].forEach(function (src) {
            for (var key in src) if (src[key] !== undefined) o[ALIASES[key] || key] = src[key];
        });
        o.locale = resolveLocale(o.locale);
        // Numbers from data-* or JS: a step of 0 or NaN would hang the time list.
        o.step = Math.min(Math.max(Math.round(+o.step) || DEFAULTS.step, 1), 24 * 60);
        o.months = Math.max(Math.round(+o.months) || DEFAULTS.months, 1);
        // Without dates there's no calendar or date presets, and empty means «all day».
        if (o.time === 'only' && o.presets === true) o.presets = false;
        if (o.vacio == null) o.vacio = o.time === 'only' ? o.locale.todoElDia : o.locale.vacio;
        if (o.sinLimite == null) o.sinLimite = o.locale.sinLimite;

        this.el = el;
        this.o = o;
        this.id = 'rs' + (++uid);
        this.min = this._val(o.min, 'desde');
        this.max = this._val(o.max, 'hasta');
        var n = normalize(this._val(o.desde, 'desde'), this._val(o.hasta, 'hasta'));
        this.desde = n[0];
        this.hasta = n[1];
        this.active = 'desde';
        this.mode = 'rango';
        this.hover = null;
        this.view = startOfMonth(this.desde || today());
        this.errors = { desde: '', hasta: '' };
        this._lastValue = null;
        this._listeners = [];

        this._build();
        this._bind();
        this._writeInputs();
        this._sync();
        el.rangeSelector = this;
    }

    /* ---------- Public API ---------- */

    RangeSelector.prototype.getValue = function () {
        var desde = toISO(this.desde, this.o.time), hasta = toISO(this.hasta, this.o.time);
        return { desde: desde, hasta: hasta, from: desde, to: hasta };
    };

    RangeSelector.prototype.setValue = function (desde, hasta) {
        var n = normalize(this._val(desde, 'desde'), this._val(hasta, 'hasta'));
        this.desde = n[0];
        this.hasta = n[1];
        this.errors = { desde: '', hasta: '' };
        this._writeInputs();
        if (this.isOpen()) this._render();
        this._sync();
        return this;
    };

    RangeSelector.prototype.clear = function () { return this.setValue(null, null); };

    RangeSelector.prototype.setLimits = function (min, max) {
        this.min = this._val(min, 'desde');
        this.max = this._val(max, 'hasta');
        FIELDS.forEach(this._commit, this);
        if (this.isOpen()) this._render();
        this._sync();
        return this;
    };

    // Can it be submitted? Parses what was typed and returns false if there are errors.
    RangeSelector.prototype.validate = function () {
        FIELDS.forEach(this._commit, this);
        this._writeInputs();
        this._sync();
        return !this.errors.desde && !this.errors.hasta;
    };

    RangeSelector.prototype.isOpen = function () { return this.el.classList.contains('rs-open'); };

    /* `field`: which field is picked first. `mode`: 'rango' (From and then To,
       what the button does) or 'campo' (only that field, what clicking a field
       does). Without `field` it starts with the missing one. */
    RangeSelector.prototype.open = function (field, mode) {
        FIELDS.forEach(this._commit, this);
        field = ALIASES[field] || field;
        this.mode = mode === 'campo' || mode === 'field' ? 'campo' : 'rango';
        this.active = field || (this.desde && !this.hasta ? 'hasta' : 'desde');
        var ref = this[this.active] || this.desde || this.hasta || today();
        // If To falls in the month right after From, both are shown at once.
        if (this.o.months > 1 && this.active === 'hasta' && this.desde && this.hasta &&
            same(addMonths(this.desde, 1), startOfMonth(this.hasta))) {
            ref = this.desde;
        }
        this.view = startOfMonth(ref);
        this.el.classList.add('rs-open');
        this.btn.setAttribute('aria-expanded', 'true');
        this.btn.setAttribute('aria-label', this._btnLabel(true));
        this._render();
        this._sync();
        this._place();
        return this;
    };

    /* The panel opens left-aligned with the control; if that overflows the right
       edge of the window it shifts left just enough, without overflowing the
       left one. */
    RangeSelector.prototype._place = function () {
        var p = this.panelEl, margin = 8;
        p.style.left = '';
        var r = p.getBoundingClientRect(), vw = document.documentElement.clientWidth;
        var shift = Math.max(Math.min(0, vw - margin - r.right), margin - r.left);
        if (shift) p.style.left = shift + 'px';
    };

    RangeSelector.prototype.close = function (refocus) {
        if (this.isOpen()) {
            this.el.classList.remove('rs-open');
            this.btn.setAttribute('aria-expanded', 'false');
            this.btn.setAttribute('aria-label', this._btnLabel(false));
            this.hover = null;
        }
        this._sync();
        if (refocus) this.btn.focus();
        return this;
    };

    RangeSelector.prototype.destroy = function () {
        this._listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        this._listeners = [];
        this.el.innerHTML = '';
        this.el.classList.remove('rs', 'rs-datetime', 'rs-timeonly', 'rs-open', 'rs-is-empty', 'rs-has-error');
        delete this.el.rangeSelector;
    };

    /* ---------- DOM ---------- */

    RangeSelector.prototype._btnLabel = function (open) {
        var L = this.o.locale, only = this.o.time === 'only';
        return open ? (only ? L.cerrarHoras : L.cerrar) : (only ? L.abrirHoras : L.abrir);
    };

    // Option or API value → Date for field `k` (with a time if `time`).
    RangeSelector.prototype._val = function (v, k) { return fromISO(v, this.o.time, k === 'hasta'); };

    RangeSelector.prototype._on = function (target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        this._listeners.push([target, type, fn, opts]);
    };

    RangeSelector.prototype._build = function () {
        var L = this.o.locale, el = this.el, id = this.id;
        var labelledby = el.getAttribute('aria-labelledby');
        el.classList.add('rs');
        el.classList.toggle('rs-datetime', this.o.time === true);
        el.classList.toggle('rs-timeonly', this.o.time === 'only');
        el.innerHTML =
            '<div class="rs-control" role="group"' + (labelledby ? ' aria-labelledby="' + esc(labelledby) + '"' : '') + '>' +
                this._fieldHTML('desde', L.desde) +
                '<span class="rs-sep" aria-hidden="true">→</span>' +
                this._fieldHTML('hasta', L.hasta) +
                '<span class="rs-vacio" aria-hidden="true">' + esc(this.o.vacio) + '</span>' +
                '<button type="button" class="rs-btn" aria-haspopup="dialog" aria-expanded="false"' +
                    ' aria-controls="' + id + '-panel" aria-label="' + esc(this._btnLabel(false)) + '">' +
                    (this.o.time === 'only' ? ICON.clock : ICON.cal) + '</button>' +
            '</div>' +
            '<input type="hidden" name="' + esc(this.o.nameDesde) + '">' +
            '<input type="hidden" name="' + esc(this.o.nameHasta) + '">' +
            '<div class="rs-error" role="alert"></div>' +
            '<div class="rs-panel" id="' + id + '-panel" role="dialog" aria-label="' + esc(L.desde + ' / ' + L.hasta) + '">' +
                (this.o.presets ? '<div class="rs-presets"></div>' : '') +
                '<div class="rs-main">' +
                    '<div class="rs-body">' +
                        '<div class="rs-months"></div>' +
                        (this.o.time ? '<div class="rs-times"><div class="rs-thead"></div><div class="rs-tlist"></div></div>' : '') +
                    '</div>' +
                    '<div class="rs-pfoot">' +
                        '<span class="rs-hint" aria-live="polite"></span>' +
                        '<span class="rs-pbtns">' +
                            '<button type="button" class="rs-pbtn rs-pbtn-clear" data-rs-clear>' + esc(this.o.vacio) + '</button>' +
                            '<button type="button" class="rs-pbtn rs-pbtn-done" data-rs-done>' + esc(L.listo) + '</button>' +
                        '</span>' +
                    '</div>' +
                '</div>' +
            '</div>';

        this.btn = el.querySelector('.rs-btn');
        this.monthsEl = el.querySelector('.rs-months');
        this.presetsEl = el.querySelector('.rs-presets');
        this.panelEl = el.querySelector('.rs-panel');
        this.theadEl = el.querySelector('.rs-thead');
        this.tlistEl = el.querySelector('.rs-tlist');
        if (this.tlistEl) {
            // The buttons are built once; `_paintTimes` only changes their state.
            this.tlistEl.innerHTML = timeSlots({ active: 'desde' }, this.o.step).map(function (t) {
                return '<button type="button" class="rs-tbtn" tabindex="-1" data-rs-time="' + t.minutes + '">' + t.label + '</button>';
            }).join('');
        }
        this.hintEl = el.querySelector('.rs-hint');
        this.errorEl = el.querySelector('.rs-error');
        var hidden = el.querySelectorAll('input[type=hidden]');
        this.hidden = { desde: hidden[0], hasta: hidden[1] };
        this.f = {};
        FIELDS.forEach(function (k) {
            var field = el.querySelector('[data-rs-field="' + k + '"]');
            this.f[k] = {
                field: field,
                input: field.querySelector('input'),
                typed: field.querySelector('.rs-typed'),
                rest: field.querySelector('.rs-rest'),
            };
        }, this);

        if (this.presetsEl) {
            var list = this.o.presets === true ? defaultPresets(null, this.o.locale.presets) : this.o.presets;
            var self = this;
            this.presetList = list.map(function (p) {
                var pd = p.desde !== undefined ? p.desde : p.from, ph = p.hasta !== undefined ? p.hasta : p.to;
                var hasta = self._val(ph, 'hasta');
                // With a time, a midnight Date in To (the built-in presets) means the whole day.
                if (self.o.time && ph instanceof Date && hasta && !hasta.getHours() && !hasta.getMinutes()) {
                    hasta = atTime(hasta, null, true);
                }
                return { label: p.label, desde: self._val(pd, 'desde'), hasta: hasta };
            });
            this.presetList.forEach(function (p, i) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'rs-preset';
                b.textContent = p.label;
                b.dataset.rsPreset = i;
                this.presetsEl.appendChild(b);
            }, this);
        }
    };

    RangeSelector.prototype._fieldHTML = function (k, label) {
        return '<label class="rs-field" data-rs-field="' + k + '">' +
            '<span class="rs-tag">' + esc(label) + '</span>' +
            '<span class="rs-wrap">' +
                '<input class="rs-input" type="text" inputmode="numeric" autocomplete="off"' +
                    ' maxlength="' + maskFor(this.o.time).length + '"' +
                    ' aria-label="' + esc(label) + ' (' + esc(this.o.locale.formatos[String(this.o.time)]) + ')">' +
                '<span class="rs-ghost" aria-hidden="true"><span class="rs-typed"></span><span class="rs-rest"></span></span>' +
            '</span>' +
        '</label>';
    };

    /* ---------- Events ---------- */

    RangeSelector.prototype._bind = function () {
        var self = this, el = this.el;

        FIELDS.forEach(function (k) {
            var inp = self.f[k].input;
            self._on(inp, 'input', function () { self._onInput(k); });
            self._on(inp, 'focus', function () {
                self.active = k;
                self._sync();
            });
            // On leaving the field, what was typed is parsed (and a short year is expanded).
            self._on(inp, 'blur', function () {
                self._commit(k);
                self._writeInputs(k);
                if (self.isOpen()) self._paint();
                self._sync();
            });
            self._on(inp, 'keydown', function (e) { self._onFieldKey(k, e); });
            // Click on a field: opens the calendar for that field (focus stays in
            // the input, so typing can continue). Tab doesn't open it.
            self._on(f(k), 'click', function () {
                if (!self.isOpen()) self.open(k, 'campo');
                else if (self.active !== k) { self.active = k; self._paint(); self._sync(); }
            });
        });
        function f(k) { return self.f[k].field; }

        this._on(this.btn, 'click', function () {
            if (self.isOpen()) self.close(true);
            else { self.open(); self._focusDay(); }
        });

        this._on(el, 'click', function (e) {
            if (e.target.closest('[data-rs-clear]')) { self.clear(); self.close(true); return; }
            if (e.target.closest('[data-rs-done]')) { self.close(true); return; }
            var pb = e.target.closest('[data-rs-preset]');
            if (pb) {
                var p = self.presetList[+pb.dataset.rsPreset];
                self.setValue(p.desde, p.hasta);
                self.close(true);
                return;
            }
            var tb = e.target.closest('[data-rs-time]');
            if (tb) { if (!tb.disabled) self._pickTime(+tb.dataset.rsTime); return; }
            var nav = e.target.closest('[data-rs-nav]');
            if (nav) { self.view = addMonths(self.view, +nav.dataset.rsNav); self._render(); return; }
            var day = e.target.closest('.rs-day');
            if (day && !day.disabled) self._pick(fromISO(day.dataset.date));
        });

        this._on(this.monthsEl, 'mouseover', function (e) {
            var day = e.target.closest('.rs-day');
            var d = day && !day.disabled ? fromISO(day.dataset.date) : null;
            if (!same(d, self.hover)) { self.hover = d; self._paint(); }
        });
        this._on(this.monthsEl, 'mouseleave', function () { self.hover = null; self._paint(); });
        this._on(this.monthsEl, 'keydown', function (e) { self._onCalendarKey(e); });
        if (this.tlistEl) this._on(this.tlistEl, 'keydown', function (e) { self._onTimeKey(e); });

        this._on(document, 'mousedown', function (e) {
            if (self.isOpen() && !el.contains(e.target)) self.close(false);
        });
        this._on(window, 'resize', function () { if (self.isOpen()) self._place(); });
        this._on(el, 'keydown', function (e) {
            if (e.key === 'Escape' && self.isOpen()) { e.preventDefault(); self.close(true); }
        });
        this._on(el, 'focusin', function () { self._sync(); });
        this._on(el, 'focusout', function () { setTimeout(function () { if (self._listeners.length) self._sync(); }, 0); });

        // With invalid dates the form isn't submitted.
        var form = el.closest('form');
        if (form) {
            this._on(form, 'submit', function (e) {
                if (!self.validate()) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    self.f[self.errors.desde ? 'desde' : 'hasta'].input.focus();
                }
            });
            this._on(form, 'reset', function () {
                setTimeout(function () { self.setValue(self.o.desde, self.o.hasta); }, 0);
            });
        }
    };

    RangeSelector.prototype._onInput = function (k) {
        var inp = this.f[k].input, T = this.o.time;
        var atEnd = inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length;
        if (atEnd) {
            inp.value = mask(inp.value, T);
        } else {
            // Editing in the middle: only invalid characters are filtered out, nothing is reflowed.
            var caret = inp.selectionStart, before = inp.value;
            var clean = before.replace(T === 'only' ? /[^\d:]/g : T ? /[^\d/ :]/g : /[^\d/]/g, '');
            if (clean !== before) {
                inp.value = clean;
                var pos = Math.max(0, caret - (before.length - clean.length));
                inp.setSelectionRange(pos, pos);
            }
        }
        this.errors[k] = '';
        if (inp.value.length === maskFor(T).length && parse(inp.value, T, k === 'hasta')) {
            this._commit(k);
            if (this.isOpen()) this._render();
            // From complete: move on to To.
            if (k === 'desde' && atEnd && this.o.autoAdvance) {
                this._sync();
                this.f.hasta.input.focus();
                this.f.hasta.input.select();
                return;
            }
        }
        this._sync();
    };

    RangeSelector.prototype._onFieldKey = function (k, e) {
        var inp = this.f[k].input, other;
        if (e.key === 'ArrowDown') {
            // Opens the calendar (or, if it's already open, moves into it).
            e.preventDefault();
            if (!this.isOpen()) this.open(k, 'campo');
            else this.active = k;
            this._focusDay();
        } else if (e.key === 'Backspace' && k === 'hasta' && !inp.value) {
            e.preventDefault();
            other = this.f.desde.input;
            other.focus();
            other.setSelectionRange(other.value.length, other.value.length);
        } else if (e.key === 'ArrowRight' && k === 'desde' && inp.selectionStart === inp.value.length) {
            e.preventDefault();
            this.f.hasta.input.focus();
            this.f.hasta.input.setSelectionRange(0, 0);
        } else if (e.key === 'ArrowLeft' && k === 'hasta' && inp.selectionStart === 0 && inp.selectionEnd === 0) {
            e.preventDefault();
            other = this.f.desde.input;
            other.focus();
            other.setSelectionRange(other.value.length, other.value.length);
        }
    };

    RangeSelector.prototype._onCalendarKey = function (e) {
        var el = e.target.closest('.rs-day');
        if (!el) return;
        var d = fromISO(el.dataset.date), n = null;
        switch (e.key) {
            case 'ArrowLeft': n = addDays(d, -1); break;
            case 'ArrowRight': n = addDays(d, 1); break;
            case 'ArrowUp': n = addDays(d, -7); break;
            case 'ArrowDown': n = addDays(d, 7); break;
            case 'Home': n = addDays(d, -((d.getDay() + 6) % 7)); break;
            case 'End': n = addDays(d, 6 - ((d.getDay() + 6) % 7)); break;
            case 'PageUp': n = ymd(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), 28)); break;
            case 'PageDown': n = ymd(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28)); break;
            case 'Enter': case ' ':
                e.preventDefault();
                if (!el.disabled) this._pick(d);
                return;
        }
        if (n) {
            e.preventDefault();
            this.hover = n;
            this._focusDay(n);
            this._paint();
        }
    };

    /* ---------- State ---------- */

    // Parses a field's text and moves it into the state (or flags the error).
    RangeSelector.prototype._commit = function (k) {
        var d = parse(this.f[k].input.value, this.o.time, k === 'hasta');
        if (d === false) {
            var L = this.o.locale;
            this.errors[k] = this.o.time === 'only' ? L.invalidaSoloHora : this.o.time ? L.invalidaHora : L.invalida;
            return;
        }
        if (!inLimits(d, this.min, this.max)) {
            this.errors[k] = this.o.locale.fueraDeRango + this._limitsText() + '.';
            return;
        }
        this.errors[k] = '';
        this[k] = d;
        var n = normalize(this.desde, this.hasta);
        if (n[0] !== this.desde) {
            this.desde = n[0];
            this.hasta = n[1];
            this._writeInputs();
        }
    };

    RangeSelector.prototype._pick = function (d) {
        this.errors = { desde: '', hasta: '' };
        // The calendar picks days; with a time, each end keeps its own.
        var s = pick({ desde: dayOf(this.desde), hasta: dayOf(this.hasta), active: this.active, mode: this.mode }, d);
        if (this.o.time) {
            var n = normalize(this._clamp(atTime(s.desde, this.desde, false)), this._clamp(atTime(s.hasta, this.hasta, true)));
            s.desde = n[0];
            s.hasta = n[1];
        }
        this.desde = s.desde;
        this.hasta = s.hasta;
        this.active = s.active;
        this._writeInputs();
        // With a time the panel stays open to adjust it; it closes with «Listo» (Done).
        if (s.done && !this.o.time) { this.close(true); return; }
        this._paint();
        this._sync();
        this._focusDay(d);
    };

    RangeSelector.prototype._writeInputs = function (only) {
        FIELDS.forEach(function (k) {
            if (only && only !== k) return;
            if (!this.errors[k]) this.f[k].input.value = toDMY(this[k], this.o.time);
        }, this);
    };

    // Within min/max: with a time, the limit's day can be picked but not before/after that time.
    RangeSelector.prototype._clamp = function (d) {
        if (d && this.min && d < this.min) return new Date(this.min.getTime());
        if (d && this.max && d > this.max) return new Date(this.max.getTime());
        return d;
    };

    // Time picked from the list for the active field (only if it already has a date).
    RangeSelector.prototype._pickTime = function (minutes) {
        var k = this.active, only = this.o.time === 'only';
        var d = only ? clock() : atTime(this[k], null);
        if (!d) return;
        d.setHours(Math.floor(minutes / 60), minutes % 60);
        if (only) {
            // Without dates, the time list is the calendar: same flow as `_pick`.
            this.errors = { desde: '', hasta: '' };
            var s = pick({ desde: this.desde, hasta: this.hasta, active: k, mode: this.mode }, d);
            this.desde = s.desde;
            this.hasta = s.hasta;
            this.active = s.active;
            this._writeInputs();
            if (s.done) { this.close(true); return; }
            this._paint();
            this._sync();
            this._focusTime();
            return;
        }
        this.errors[k] = '';
        this[k] = d;
        this._writeInputs(k);
        this._paint();
        this._sync();
    };

    RangeSelector.prototype._limitsText = function () {
        var T = this.o.time, L = this.o.locale;
        if (this.min && this.max) return ' (' + toDMY(this.min, T) + ' – ' + toDMY(this.max, T) + ')';
        if (this.min) return ' (' + L.desde.toLowerCase() + ' ' + toDMY(this.min, T) + ')';
        if (this.max) return ' (' + L.hasta.toLowerCase() + ' ' + toDMY(this.max, T) + ')';
        return '';
    };

    /* ---------- Calendar ---------- */

    // Rebuilds the months. Only when the visible month changes (not on every focus: keyboard focus would be lost).
    RangeSelector.prototype._render = function () {
        if (this.o.time === 'only') { this._paint(); return; }
        var L = this.o.locale, t = today(), html = '', count = this.o.months;
        for (var m = 0; m < count; m++) {
            var first = addMonths(this.view, m);
            var start = addDays(first, -((first.getDay() + 6) % 7));
            html += '<div class="rs-month">' +
                '<div class="rs-mhead">' +
                    '<button type="button" class="rs-nav" data-rs-nav="-1" aria-label="' + esc(L.mesAnterior) + '"' +
                        (m === 0 ? '' : ' data-rs-hide-desktop') + '>' + ICON.left + '</button>' +
                    '<span class="rs-mtitle">' + esc(L.months[first.getMonth()] + ' ' + first.getFullYear()) + '</span>' +
                    '<button type="button" class="rs-nav" data-rs-nav="1" aria-label="' + esc(L.mesSiguiente) + '"' +
                        (m === count - 1 ? '' : ' data-rs-hide-desktop') + '>' + ICON.right + '</button>' +
                '</div>' +
                '<div class="rs-days" role="grid">';
            L.weekdays.forEach(function (w) { html += '<span class="rs-dow">' + esc(w) + '</span>'; });
            for (var i = 0; i < 42; i++) {
                var d = addDays(start, i);
                var out = d.getMonth() !== first.getMonth();
                html += '<button type="button" class="rs-day' + (out ? ' rs-out' : '') + (same(d, t) ? ' rs-today' : '') + '"' +
                    ' data-date="' + toISO(d) + '" tabindex="-1"' +
                    ' aria-label="' + esc(L.dia(d, L.months)) + '">' +
                    '<span>' + d.getDate() + '</span></button>';
            }
            html += '</div></div>';
        }
        this.monthsEl.innerHTML = html;
        this._paint();
    };

    // Paints start, end, span and (hover) preview without touching the calendar's DOM.
    RangeSelector.prototype._paint = function () {
        if (!this.isOpen()) return;
        var a = dayOf(this.desde), b = dayOf(this.hasta), hv = this.hover;
        // Hover preview, symmetric: picking To previews From → day; picking From previews day → To.
        var prevEnd = (this.active === 'hasta' && a && hv && hv >= a) ? hv : null;
        var prevStart = (this.active === 'desde' && b && hv && hv <= b) ? hv : null;
        var lo = prevStart || a, hi = prevEnd || b;
        var state = { desde: a, hasta: b, active: this.active, mode: this.mode };
        var min = this.min, max = this.max;
        this.monthsEl.querySelectorAll('.rs-day').forEach(function (el) {
            var d = fromISO(el.dataset.date);
            var inMonth = !el.classList.contains('rs-out');
            // Depends on the active field ('campo' mode), which changes while the panel is open.
            el.disabled = !selectable(d, state, min, max);
            el.classList.toggle('rs-start', inMonth && same(d, lo));
            el.classList.toggle('rs-end', inMonth && same(d, hi));
            el.classList.toggle('rs-in-range', inMonth && !!lo && !!hi && d > lo && d < hi);
            el.classList.toggle('rs-preview', inMonth && (
                (!!prevEnd && !same(prevEnd, b) && d > a && d <= prevEnd) ||
                (!!prevStart && !same(prevStart, a) && d >= prevStart && d < b)));
            // While previewing, the end about to be replaced stays faintly marked.
            el.classList.toggle('rs-current', inMonth && (
                (!!prevEnd && !same(prevEnd, b) && same(d, b)) ||
                (!!prevStart && !same(prevStart, a) && same(d, a))));
            el.setAttribute('aria-selected', inMonth && (same(d, a) || same(d, b)) ? 'true' : 'false');
        });
        this._paintTimes();
    };

    // Time list for the active field: which can be picked and which is current.
    RangeSelector.prototype._paintTimes = function () {
        if (!this.tlistEl || !this.isOpen()) return;
        var L = this.o.locale, k = this.active;
        var only = this.o.time === 'only';
        var slots = timeSlots({ desde: this.desde, hasta: this.hasta, active: k, free: only && this.mode === 'rango' },
            this.o.step, this.min, this.max, only ? clock() : null);
        var btns = this.tlistEl.children, on = null;
        this.theadEl.textContent = L.hora + ' · ' + (k === 'desde' ? L.desde : L.hasta);
        slots.forEach(function (t, i) {
            btns[i].disabled = !t.enabled;
            btns[i].classList.toggle('rs-on', t.on);
            btns[i].setAttribute('aria-pressed', t.on ? 'true' : 'false');
            if (t.on) on = btns[i];
        });
        // When the field or time changes, the current time is scrolled into view (without moving the page).
        var key = k + '|' + toISO(this[k], this.o.time);
        if (key !== this._timesKey) {
            this._timesKey = key;
            var list = this.tlistEl, target = on || btns[Math.floor(btns.length / 3)];
            if (target) {
                if (list.scrollHeight > list.clientHeight) list.scrollTop = target.offsetTop - list.clientHeight / 2 + target.offsetHeight / 2;
                if (list.scrollWidth > list.clientWidth) list.scrollLeft = target.offsetLeft - list.clientWidth / 2 + target.offsetWidth / 2;
            }
        }
    };

    RangeSelector.prototype._focusDay = function (d) {
        if (this.o.time === 'only') { this._focusTime(); return; }
        var target = d || this[this.active] || this.desde || today();
        var sel = '.rs-day:not(.rs-out)[data-date="' + toISO(target) + '"]';
        var el = this.monthsEl.querySelector(sel);
        if (!el) {
            this.view = startOfMonth(target);
            this._render();
            el = this.monthsEl.querySelector(sel);
        }
        if (el) {
            this.monthsEl.querySelectorAll('.rs-day[tabindex="0"]').forEach(function (x) { x.tabIndex = -1; });
            el.tabIndex = 0;
            el.focus();
        }
    };

    // Focus in the time list: the current time or, if none, the first one that can be picked.
    RangeSelector.prototype._focusTime = function (btn) {
        if (!this.tlistEl) return;
        this._paintTimes();
        btn = btn || this.tlistEl.querySelector('.rs-tbtn.rs-on:not(:disabled)') ||
            this.tlistEl.querySelector('.rs-tbtn:not(:disabled)');
        if (!btn) return;
        Array.prototype.forEach.call(this.tlistEl.children, function (x) { x.tabIndex = x === btn ? 0 : -1; });
        btn.focus();
    };

    // Arrows in the time list: to the previous / next one that can be picked.
    RangeSelector.prototype._onTimeKey = function (e) {
        var btn = e.target.closest('.rs-tbtn'), dir = 0;
        if (!btn) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') dir = -1;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') dir = 1;
        else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            var all = this.tlistEl.querySelectorAll('.rs-tbtn:not(:disabled)');
            if (all.length) this._focusTime(all[e.key === 'Home' ? 0 : all.length - 1]);
            return;
        }
        if (!dir) return;
        e.preventDefault();
        var n = btn;
        do { n = dir < 0 ? n.previousElementSibling : n.nextElementSibling; } while (n && n.disabled);
        if (n) this._focusTime(n);
    };

    /* ---------- Painting the control ---------- */

    RangeSelector.prototype._sync = function () {
        var self = this, el = this.el, open = this.isOpen();
        var focusIn = el.contains(document.activeElement);

        FIELDS.forEach(function (k) {
            var f = self.f[k], v = f.input.value, focused = document.activeElement === f.input;
            self.hidden[k].value = self.errors[k] ? '' : toISO(self[k], self.o.time);
            f.field.classList.toggle('rs-active', open && self.active === k);
            f.field.classList.toggle('rs-invalid', !!self.errors[k]);
            f.input.setAttribute('aria-invalid', self.errors[k] ? 'true' : 'false');

            // Guide: what's typed covers its part of «__/__/____»; empty and unfocused, «Sin límite».
            if (!v && !focused && !open) {
                f.typed.textContent = '';
                f.rest.textContent = self.o.sinLimite;
            } else if (fitsMask(v, self.o.time)) {
                f.typed.textContent = v;
                f.rest.textContent = guideFor(self.o.time).slice(v.length);
            } else {
                f.typed.textContent = '';
                f.rest.textContent = '';
            }
        });

        // Empty range and nobody typing: the control says what it means (`vacio`).
        el.classList.toggle('rs-is-empty',
            !this.f.desde.input.value && !this.f.hasta.input.value && !focusIn && !open);

        var err = this.errors.desde || this.errors.hasta;
        el.classList.toggle('rs-has-error', !!err);
        this.errorEl.textContent = err;

        if (open) {
            this._paintTimes();
            this.hintEl.innerHTML = esc(this.o.locale.elegir) + ' <b>' +
                esc(this.active === 'desde' ? this.o.locale.desde : this.o.locale.hasta) + '</b>';
            if (this.presetsEl) {
                var a = this.desde, b = this.hasta;
                this.presetList.forEach(function (p, i) {
                    self.presetsEl.children[i].classList.toggle('rs-on', same(a, p.desde) && same(b, p.hasta));
                });
            }
        }

        var value = this.hidden.desde.value + '|' + this.hidden.hasta.value;
        if (value !== this._lastValue) {
            var first = this._lastValue === null;
            this._lastValue = value;
            if (!first) {
                var detail = this.getValue();
                el.dispatchEvent(new CustomEvent('rangeselector:change', { bubbles: true, detail: detail }));
                if (typeof this.o.onChange === 'function') this.o.onChange(detail);
            }
        }
    };

    /* ---------- Auto-init ---------- */

    RangeSelector.utils = utils;
    RangeSelector.defaults = DEFAULTS;
    RangeSelector.locale = LOCALE;
    RangeSelector.locales = LOCALES;

    RangeSelector.init = function (scope) {
        return Array.prototype.map.call(
            (scope || document).querySelectorAll('[data-range-selector]'),
            function (el) { return new RangeSelector(el); }
        );
    };

    /* Initialize right away (elements before the <script> already exist, and this
       way their submit validation runs before any handlers the page adds) and
       again once loading finishes, for the ones that come later. Repeating is
       harmless: the constructor returns the element's existing instance. */
    if (typeof document !== 'undefined') {
        RangeSelector.init();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { RangeSelector.init(); });
        }
    }

    return RangeSelector;
});
