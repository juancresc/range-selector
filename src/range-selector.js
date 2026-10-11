/*!
 * RangeSelector — selector de rango de fechas «Desde → Hasta».
 *
 * Dos inputs tipeables con máscara (dd/mm/aaaa) dentro de un mismo control, y
 * un calendario de dos meses detrás de un botón. Sin dependencias.
 *
 *   <div data-range-selector data-name-desde="desde" data-name-hasta="hasta"></div>
 *   <script src="range-selector.js"></script>   (auto-inicializa los [data-range-selector])
 *
 *   const rs = new RangeSelector(el, { vacio: 'Este mes', min: '2026-01-01' });
 *   rs.getValue()  // { desde: '2026-10-01', hasta: '2026-10-11' }
 *
 * Ver README.md para opciones, métodos y eventos.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.RangeSelector = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* =====================================================================
     * Utilidades puras (sin DOM): exportadas en RangeSelector.utils y testeadas.
     * Todas las fechas son Date a medianoche local.
     * ===================================================================== */

    var MASK = '##/##/####';
    var GUIDE = '__/__/____';

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function ymd(y, m, d) { return new Date(y, m, d); }
    function today() { var d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }
    function addDays(d, n) { return ymd(d.getFullYear(), d.getMonth(), d.getDate() + n); }
    function addMonths(d, n) { return ymd(d.getFullYear(), d.getMonth() + n, 1); }
    function startOfMonth(d) { return ymd(d.getFullYear(), d.getMonth(), 1); }
    function same(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }

    // Fecha real o null: 31/02 no existe.
    function real(y, m, d) {
        var dt = ymd(y, m - 1, d);
        return (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) ? dt : null;
    }
    function toISO(d) { return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : ''; }
    function toDMY(d) { return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
    function fromISO(s) {
        if (s instanceof Date) return ymd(s.getFullYear(), s.getMonth(), s.getDate());
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
        return m ? real(+m[1], +m[2], +m[3]) : null;
    }

    /* Texto del input → Date, null (vacío) o false (inválido).
     * Acepta dd/mm/aaaa y dd/mm/aa (el año corto es 20aa). */
    function parse(s) {
        s = (s || '').trim();
        if (!s) return null;
        var m = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(s);
        if (!m) return false;
        var y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
        return real(y, +m[2], +m[1]) || false;
    }

    // Guía de tipeo: arma "dd/mm/aaaa" con los dígitos, insertando las barras.
    function mask(v) {
        var digits = String(v || '').replace(/\D/g, '').slice(0, 8), out = '', di = 0;
        for (var i = 0; i < MASK.length && di < digits.length; i++) {
            out += MASK[i] === '#' ? digits[di++] : MASK[i];
        }
        return out;
    }

    // ¿`v` es un prefijo incompleto bien formado de la máscara? (ahí se dibuja el resto de la guía)
    function fitsMask(v) {
        if (v.length >= MASK.length) return false;
        for (var i = 0; i < v.length; i++) {
            if (MASK[i] === '#' ? !/\d/.test(v[i]) : v[i] !== MASK[i]) return false;
        }
        return true;
    }

    // Desde después de Hasta: se invierten.
    function normalize(desde, hasta) {
        return (desde && hasta && desde > hasta) ? [hasta, desde] : [desde, hasta];
    }

    function inLimits(d, min, max) { return !d || ((!min || d >= min) && (!max || d <= max)); }

    /* ¿El día `d` se puede elegir? Además de min/max, eligiendo un solo campo
       (modo 'campo') no se ofrecen días que dejarían Desde después de Hasta. */
    function selectable(d, state, min, max) {
        if (!inLimits(d, min, max)) return false;
        if (state.mode !== 'campo') return true;
        if (state.active === 'desde' && state.hasta && d > state.hasta) return false;
        if (state.active === 'hasta' && state.desde && d < state.desde) return false;
        return true;
    }

    /* Qué pasa al elegir el día `d` en el calendario con el campo `active`.
     * `state.mode`:
     *   'rango' (botón del calendario): Desde y después Hasta, en una pasada.
     *   'campo' (click en un campo): sólo cambia ese campo y cierra.
     * Devuelve el estado nuevo: { desde, hasta, active, done }. `done` = listo,
     * el panel se puede cerrar. */
    function pick(state, d) {
        var desde = state.desde, hasta = state.hasta;
        if (state.mode === 'campo') {
            // En este modo los días que invertirían el rango están deshabilitados
            // (ver `disabledFor`); por las dudas, igual se normaliza.
            var n = normalize(state.active === 'desde' ? d : desde, state.active === 'hasta' ? d : hasta);
            return { desde: n[0], hasta: n[1], active: state.active, done: true };
        }
        if (state.active === 'desde') {
            return { desde: d, hasta: (hasta && hasta < d) ? null : hasta, active: 'hasta', done: false };
        }
        if (desde && d < desde) {
            // Un día anterior a Desde mientras se elige Hasta: el rango arranca ahí.
            return { desde: d, hasta: hasta, active: 'hasta', done: false };
        }
        return { desde: desde, hasta: d, active: 'hasta', done: true };
    }

    function defaultPresets(t) {
        t = t || today();
        var lunes = addDays(t, -((t.getDay() + 6) % 7));
        return [
            { label: 'Hoy', desde: t, hasta: t },
            { label: 'Ayer', desde: addDays(t, -1), hasta: addDays(t, -1) },
            { label: 'Esta semana', desde: lunes, hasta: t },
            { label: 'Últimos 7 días', desde: addDays(t, -6), hasta: t },
            { label: 'Últimos 30 días', desde: addDays(t, -29), hasta: t },
            { label: 'Este mes', desde: ymd(t.getFullYear(), t.getMonth(), 1), hasta: ymd(t.getFullYear(), t.getMonth() + 1, 0) },
            { label: 'Mes anterior', desde: ymd(t.getFullYear(), t.getMonth() - 1, 1), hasta: ymd(t.getFullYear(), t.getMonth(), 0) },
            { label: 'Año en curso', desde: ymd(t.getFullYear(), 0, 1), hasta: t },
        ];
    }

    var utils = {
        MASK: MASK, GUIDE: GUIDE, parse: parse, mask: mask, fitsMask: fitsMask,
        toISO: toISO, toDMY: toDMY, fromISO: fromISO, normalize: normalize,
        inLimits: inLimits, selectable: selectable, pick: pick, defaultPresets: defaultPresets, today: today,
    };

    /* =====================================================================
     * Componente
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
        fueraDeRango: 'Fuera del rango permitido',
    };

    var DEFAULTS = {
        nameDesde: 'desde',
        nameHasta: 'hasta',
        desde: null,              // 'AAAA-MM-DD' | Date
        hasta: null,
        min: null,
        max: null,
        vacio: 'Todas las fechas', // qué significa el rango vacío (y texto del botón que lo vacía)
        sinLimite: 'Sin límite',   // un lado vacío de un rango abierto
        presets: true,            // true (los de siempre) | false | [{label, desde, hasta}]
        months: 2,
        autoAdvance: true,        // Desde completo → salta a Hasta
        onChange: null,           // fn({desde, hasta}) en ISO
        locale: {},
    };

    var ICON = {
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

    // data-* del elemento → opciones (data-name-desde → nameDesde, etc.).
    function optionsFromData(el) {
        var d = el.dataset, o = {};
        ['nameDesde', 'nameHasta', 'desde', 'hasta', 'min', 'max', 'vacio', 'sinLimite'].forEach(function (k) {
            if (d[k] !== undefined && d[k] !== '') o[k] = d[k];
        });
        if (d.presets === 'false') o.presets = false;
        if (d.months) o.months = +d.months;
        if (d.autoAdvance === 'false') o.autoAdvance = false;
        return o;
    }

    function RangeSelector(el, options) {
        if (!(this instanceof RangeSelector)) return new RangeSelector(el, options);
        if (typeof el === 'string') el = document.querySelector(el);
        if (!el) throw new Error('RangeSelector: no se encontró el elemento.');
        if (el.rangeSelector) return el.rangeSelector;

        var o = {}, k;
        for (k in DEFAULTS) o[k] = DEFAULTS[k];
        var fromData = optionsFromData(el);
        for (k in fromData) o[k] = fromData[k];
        for (k in (options || {})) o[k] = options[k];
        o.locale = Object.assign({}, LOCALE, o.locale || {});

        this.el = el;
        this.o = o;
        this.id = 'rs' + (++uid);
        this.min = fromISO(o.min);
        this.max = fromISO(o.max);
        var n = normalize(fromISO(o.desde), fromISO(o.hasta));
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

    /* ---------- API pública ---------- */

    RangeSelector.prototype.getValue = function () {
        return { desde: toISO(this.desde), hasta: toISO(this.hasta) };
    };

    RangeSelector.prototype.setValue = function (desde, hasta) {
        var n = normalize(fromISO(desde), fromISO(hasta));
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
        this.min = fromISO(min);
        this.max = fromISO(max);
        FIELDS.forEach(this._commit, this);
        if (this.isOpen()) this._render();
        this._sync();
        return this;
    };

    // ¿Se puede enviar? Interpreta lo tipeado y devuelve false si hay errores.
    RangeSelector.prototype.validate = function () {
        FIELDS.forEach(this._commit, this);
        this._writeInputs();
        this._sync();
        return !this.errors.desde && !this.errors.hasta;
    };

    RangeSelector.prototype.isOpen = function () { return this.el.classList.contains('rs-open'); };

    /* `field`: qué campo se elige primero. `mode`: 'rango' (Desde y después Hasta,
       lo que hace el botón) o 'campo' (sólo ese campo, lo que hace el click en un
       campo). Sin `field` arranca por el que falta. */
    RangeSelector.prototype.open = function (field, mode) {
        FIELDS.forEach(this._commit, this);
        this.mode = mode === 'campo' ? 'campo' : 'rango';
        this.active = field || (this.desde && !this.hasta ? 'hasta' : 'desde');
        var ref = this[this.active] || this.desde || this.hasta || today();
        // Si Hasta cae justo en el mes siguiente a Desde, se ven los dos a la vez.
        if (this.o.months > 1 && this.active === 'hasta' && this.desde && this.hasta &&
            same(addMonths(this.desde, 1), startOfMonth(this.hasta))) {
            ref = this.desde;
        }
        this.view = startOfMonth(ref);
        this.el.classList.add('rs-open');
        this.btn.setAttribute('aria-expanded', 'true');
        this.btn.setAttribute('aria-label', this.o.locale.cerrar);
        this._render();
        this._sync();
        return this;
    };

    RangeSelector.prototype.close = function (refocus) {
        if (this.isOpen()) {
            this.el.classList.remove('rs-open');
            this.btn.setAttribute('aria-expanded', 'false');
            this.btn.setAttribute('aria-label', this.o.locale.abrir);
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
        this.el.classList.remove('rs', 'rs-open', 'rs-is-empty', 'rs-has-error');
        delete this.el.rangeSelector;
    };

    /* ---------- DOM ---------- */

    RangeSelector.prototype._on = function (target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        this._listeners.push([target, type, fn, opts]);
    };

    RangeSelector.prototype._build = function () {
        var L = this.o.locale, el = this.el, id = this.id;
        var labelledby = el.getAttribute('aria-labelledby');
        el.classList.add('rs');
        el.innerHTML =
            '<div class="rs-control" role="group"' + (labelledby ? ' aria-labelledby="' + esc(labelledby) + '"' : '') + '>' +
                this._fieldHTML('desde', L.desde) +
                '<span class="rs-sep" aria-hidden="true">→</span>' +
                this._fieldHTML('hasta', L.hasta) +
                '<span class="rs-vacio" aria-hidden="true">' + esc(this.o.vacio) + '</span>' +
                '<button type="button" class="rs-btn" aria-haspopup="dialog" aria-expanded="false"' +
                    ' aria-controls="' + id + '-panel" aria-label="' + esc(L.abrir) + '">' + ICON.cal + '</button>' +
            '</div>' +
            '<input type="hidden" name="' + esc(this.o.nameDesde) + '">' +
            '<input type="hidden" name="' + esc(this.o.nameHasta) + '">' +
            '<div class="rs-error" role="alert"></div>' +
            '<div class="rs-panel" id="' + id + '-panel" role="dialog" aria-label="' + esc(L.desde + ' / ' + L.hasta) + '">' +
                (this.o.presets ? '<div class="rs-presets"></div>' : '') +
                '<div class="rs-main">' +
                    '<div class="rs-months"></div>' +
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
            var list = this.o.presets === true ? defaultPresets() : this.o.presets;
            this.presetList = list.map(function (p) {
                return { label: p.label, desde: fromISO(p.desde), hasta: fromISO(p.hasta) };
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
                '<input class="rs-input" type="text" inputmode="numeric" autocomplete="off" maxlength="10"' +
                    ' aria-label="' + esc(label) + ' (dd/mm/aaaa)">' +
                '<span class="rs-ghost" aria-hidden="true"><span class="rs-typed"></span><span class="rs-rest"></span></span>' +
            '</span>' +
        '</label>';
    };

    /* ---------- Eventos ---------- */

    RangeSelector.prototype._bind = function () {
        var self = this, el = this.el;

        FIELDS.forEach(function (k) {
            var inp = self.f[k].input;
            self._on(inp, 'input', function () { self._onInput(k); });
            self._on(inp, 'focus', function () {
                self.active = k;
                self._sync();
            });
            // Al salir del campo se interpreta lo tipeado (y se completa el año corto).
            self._on(inp, 'blur', function () {
                self._commit(k);
                self._writeInputs(k);
                if (self.isOpen()) self._paint();
                self._sync();
            });
            self._on(inp, 'keydown', function (e) { self._onFieldKey(k, e); });
            // Click en un campo: abre el calendario para ese campo (el foco queda en
            // el input, así que se puede seguir tipeando). Tab no lo abre.
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

        this._on(document, 'mousedown', function (e) {
            if (self.isOpen() && !el.contains(e.target)) self.close(false);
        });
        this._on(el, 'keydown', function (e) {
            if (e.key === 'Escape' && self.isOpen()) { e.preventDefault(); self.close(true); }
        });
        this._on(el, 'focusin', function () { self._sync(); });
        this._on(el, 'focusout', function () { setTimeout(function () { self._sync(); }, 0); });

        // Con fechas inválidas el form no se envía.
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
        var inp = this.f[k].input;
        var atEnd = inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length;
        if (atEnd) {
            inp.value = mask(inp.value);
        } else {
            // Editando en el medio: sólo se filtran caracteres inválidos, nunca se reacomoda.
            var caret = inp.selectionStart, before = inp.value;
            var clean = before.replace(/[^\d/]/g, '');
            if (clean !== before) {
                inp.value = clean;
                var pos = Math.max(0, caret - (before.length - clean.length));
                inp.setSelectionRange(pos, pos);
            }
        }
        this.errors[k] = '';
        if (inp.value.length === MASK.length && parse(inp.value)) {
            this._commit(k);
            if (this.isOpen()) this._render();
            // Desde completo: se pasa a Hasta.
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
            // Abre el calendario (o, si ya está abierto, entra en él).
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

    /* ---------- Estado ---------- */

    // Interpreta el texto de un campo y lo pasa al estado (o marca el error).
    RangeSelector.prototype._commit = function (k) {
        var d = parse(this.f[k].input.value);
        if (d === false) { this.errors[k] = this.o.locale.invalida; return; }
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
        var s = pick({ desde: this.desde, hasta: this.hasta, active: this.active, mode: this.mode }, d);
        this.desde = s.desde;
        this.hasta = s.hasta;
        this.active = s.active;
        this._writeInputs();
        if (s.done) { this.close(true); return; }
        this._paint();
        this._sync();
        this._focusDay(d);
    };

    RangeSelector.prototype._writeInputs = function (only) {
        FIELDS.forEach(function (k) {
            if (only && only !== k) return;
            if (!this.errors[k]) this.f[k].input.value = toDMY(this[k]);
        }, this);
    };

    RangeSelector.prototype._limitsText = function () {
        if (this.min && this.max) return ' (' + toDMY(this.min) + ' – ' + toDMY(this.max) + ')';
        if (this.min) return ' (desde ' + toDMY(this.min) + ')';
        if (this.max) return ' (hasta ' + toDMY(this.max) + ')';
        return '';
    };

    /* ---------- Calendario ---------- */

    // Rearma los meses. Sólo cuando cambia el mes visible (no en cada foco: perdería el foco del teclado).
    RangeSelector.prototype._render = function () {
        var L = this.o.locale, t = today(), html = '', count = this.o.months;
        for (var m = 0; m < count; m++) {
            var first = addMonths(this.view, m);
            var start = addDays(first, -((first.getDay() + 6) % 7));
            html += '<div class="rs-month">' +
                '<div class="rs-mhead">' +
                    '<button type="button" class="rs-nav" data-rs-nav="-1" aria-label="' + esc(L.mesAnterior) + '"' +
                        (m === 0 ? '' : ' data-rs-hide-desktop') + '>' + ICON.left + '</button>' +
                    '<span class="rs-mtitle">' + L.months[first.getMonth()] + ' ' + first.getFullYear() + '</span>' +
                    '<button type="button" class="rs-nav" data-rs-nav="1" aria-label="' + esc(L.mesSiguiente) + '"' +
                        (m === count - 1 ? '' : ' data-rs-hide-desktop') + '>' + ICON.right + '</button>' +
                '</div>' +
                '<div class="rs-days" role="grid">';
            L.weekdays.forEach(function (w) { html += '<span class="rs-dow">' + w + '</span>'; });
            for (var i = 0; i < 42; i++) {
                var d = addDays(start, i);
                var out = d.getMonth() !== first.getMonth();
                html += '<button type="button" class="rs-day' + (out ? ' rs-out' : '') + (same(d, t) ? ' rs-today' : '') + '"' +
                    ' data-date="' + toISO(d) + '" tabindex="-1"' +
                    ' aria-label="' + d.getDate() + ' de ' + L.months[d.getMonth()] + ' de ' + d.getFullYear() + '">' +
                    '<span>' + d.getDate() + '</span></button>';
            }
            html += '</div></div>';
        }
        this.monthsEl.innerHTML = html;
        this._paint();
    };

    // Pinta inicio, fin, tramo y vista previa (hover) sin tocar el DOM del calendario.
    RangeSelector.prototype._paint = function () {
        if (!this.isOpen()) return;
        var a = this.desde, b = this.hasta, hv = this.hover;
        var preview = (this.active === 'hasta' && a && hv && hv >= a) ? hv : null;
        var hi = preview || b;
        var state = { desde: a, hasta: b, active: this.active, mode: this.mode };
        var min = this.min, max = this.max;
        this.monthsEl.querySelectorAll('.rs-day').forEach(function (el) {
            var d = fromISO(el.dataset.date);
            var inMonth = !el.classList.contains('rs-out');
            // Depende del campo activo (modo 'campo'), que cambia con el panel abierto.
            el.disabled = !selectable(d, state, min, max);
            el.classList.toggle('rs-start', inMonth && same(d, a));
            el.classList.toggle('rs-end', inMonth && same(d, hi));
            el.classList.toggle('rs-in-range', inMonth && !!a && !!hi && d > a && d < hi);
            el.classList.toggle('rs-preview', inMonth && !!preview && !same(preview, b) && d > a && d <= preview);
            el.setAttribute('aria-selected', inMonth && (same(d, a) || same(d, b)) ? 'true' : 'false');
        });
    };

    RangeSelector.prototype._focusDay = function (d) {
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

    /* ---------- Pintar el control ---------- */

    RangeSelector.prototype._sync = function () {
        var self = this, el = this.el, open = this.isOpen();
        var focusIn = el.contains(document.activeElement);

        FIELDS.forEach(function (k) {
            var f = self.f[k], v = f.input.value, focused = document.activeElement === f.input;
            self.hidden[k].value = self.errors[k] ? '' : toISO(self[k]);
            f.field.classList.toggle('rs-active', open && self.active === k);
            f.field.classList.toggle('rs-invalid', !!self.errors[k]);
            f.input.setAttribute('aria-invalid', self.errors[k] ? 'true' : 'false');

            // Guía: lo tipeado tapa su parte de «__/__/____»; vacío y sin foco, «Sin límite».
            if (!v && !focused && !open) {
                f.typed.textContent = '';
                f.rest.textContent = self.o.sinLimite;
            } else if (fitsMask(v)) {
                f.typed.textContent = v;
                f.rest.textContent = GUIDE.slice(v.length);
            } else {
                f.typed.textContent = '';
                f.rest.textContent = '';
            }
        });

        // Rango vacío y nadie tipeando: el control dice qué significa (`vacio`).
        el.classList.toggle('rs-is-empty',
            !this.f.desde.input.value && !this.f.hasta.input.value && !focusIn && !open);

        var err = this.errors.desde || this.errors.hasta;
        el.classList.toggle('rs-has-error', !!err);
        this.errorEl.textContent = err;

        if (open) {
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

    RangeSelector.init = function (scope) {
        return Array.prototype.map.call(
            (scope || document).querySelectorAll('[data-range-selector]'),
            function (el) { return new RangeSelector(el); }
        );
    };

    /* Se inicializa ya (los elementos que están antes del <script> existen, y así
       su validación del submit queda antes que los handlers que agregue la página)
       y de nuevo al terminar de cargar, para los que vienen después. Repetir es
       inocuo: el constructor devuelve la instancia que ya tiene el elemento. */
    if (typeof document !== 'undefined') {
        RangeSelector.init();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { RangeSelector.init(); });
        }
    }

    return RangeSelector;
});
