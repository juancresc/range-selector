// Type definitions for range-selector.

/** ISO value: 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm' (time: true) or 'HH:mm' (time: 'only'). */
type ISOValue = string;
type DateInput = ISOValue | Date | null;
type Field = 'desde' | 'hasta' | 'from' | 'to';
type Mode = 'rango' | 'campo' | 'range' | 'field';

declare namespace RangeSelector {
    interface Value {
        /** From, as ISO; '' when empty. */
        desde: ISOValue;
        /** To, as ISO; '' when empty. */
        hasta: ISOValue;
        /** Alias of `desde`. */
        from: ISOValue;
        /** Alias of `hasta`. */
        to: ISOValue;
    }

    interface Preset {
        label: string;
        desde?: DateInput;
        hasta?: DateInput;
        /** Alias of `desde`. */
        from?: DateInput;
        /** Alias of `hasta`. */
        to?: DateInput;
    }

    interface PresetLabels {
        hoy: string;
        ayer: string;
        estaSemana: string;
        ultimos7: string;
        ultimos30: string;
        esteMes: string;
        mesAnterior: string;
        anioEnCurso: string;
    }

    interface Locale {
        months: string[];
        weekdays: string[];
        desde: string;
        hasta: string;
        listo: string;
        elegir: string;
        abrir: string;
        cerrar: string;
        mesAnterior: string;
        mesSiguiente: string;
        invalida: string;
        invalidaHora: string;
        invalidaSoloHora: string;
        hora: string;
        abrirHoras: string;
        cerrarHoras: string;
        todoElDia: string;
        vacio: string;
        sinLimite: string;
        fueraDeRango: string;
        /** Format announced in each field's aria-label, by `time` mode. */
        formatos: { 'false': string; 'true': string; 'only': string };
        /** aria-label of each calendar day. */
        dia: (date: Date, months: string[]) => string;
        presets: PresetLabels;
    }

    /** Texts to override, on top of Spanish or of the built-in locale named in `base`. */
    type LocaleOverrides = Partial<Omit<Locale, 'formatos' | 'presets'>> & {
        base?: 'es' | 'en';
        formatos?: Partial<Locale['formatos']>;
        presets?: Partial<PresetLabels>;
    };

    interface Options {
        /** `name` of the From hidden input. Default 'desde'. */
        nameDesde?: string;
        /** `name` of the To hidden input. Default 'hasta'. */
        nameHasta?: string;
        /** Alias of `nameDesde`. */
        nameFrom?: string;
        /** Alias of `nameHasta`. */
        nameTo?: string;
        /** Initial From value. */
        desde?: DateInput;
        /** Initial To value. */
        hasta?: DateInput;
        /** Alias of `desde`. */
        from?: DateInput;
        /** Alias of `hasta`. */
        to?: DateInput;
        min?: DateInput;
        max?: DateInput;
        /** What choosing no range means. Default: the locale's (`'Todas las fechas'` / `'All dates'`). */
        vacio?: string;
        /** Alias of `vacio`. */
        empty?: string;
        /** Empty side of an open range. Default: the locale's (`'Sin límite'` / `'No limit'`). */
        sinLimite?: string;
        /** Alias of `sinLimite`. */
        noLimit?: string;
        /** Default true (false with time: 'only'). */
        presets?: boolean | Preset[];
        /** Months visible in the calendar. Default 2. */
        months?: number;
        /** Jump to To when From is complete. Default true. */
        autoAdvance?: boolean;
        /** false: date only · true: date + optional time · 'only': time only. Default false. */
        time?: boolean | 'only';
        /** Minutes between the times offered in the panel. Default 30. */
        step?: number;
        onChange?: ((value: Value) => void) | null;
        /** 'es' (default), 'en', or texts to override. */
        locale?: 'es' | 'en' | LocaleOverrides;
    }

    interface Utils {
        MASK: string;
        GUIDE: string;
        MASK_T: string;
        GUIDE_T: string;
        MASK_H: string;
        GUIDE_H: string;
        maskFor(time?: boolean | 'only'): string;
        guideFor(time?: boolean | 'only'): string;
        /** Typed text → Date, null (empty) or false (invalid). */
        parse(text: string, time?: boolean | 'only', isHasta?: boolean): Date | null | false;
        mask(text: string, time?: boolean | 'only'): string;
        fitsMask(text: string, time?: boolean | 'only'): boolean;
        toISO(date: Date | null, time?: boolean | 'only'): string;
        toDMY(date: Date | null, time?: boolean | 'only'): string;
        fromISO(value: DateInput | undefined, time?: boolean | 'only', isHasta?: boolean): Date | null;
        normalize(desde: Date | null, hasta: Date | null): [Date | null, Date | null];
        dayOf(date: Date | null): Date | null;
        atTime(day: Date | null, ref?: Date | null, isHasta?: boolean): Date | null;
        clock(hours?: number, minutes?: number): Date;
        inLimits(date: Date | null, min?: Date | null, max?: Date | null): boolean;
        selectable(day: Date, state: { desde: Date | null; hasta: Date | null; active: 'desde' | 'hasta'; mode?: 'rango' | 'campo' },
            min?: Date | null, max?: Date | null): boolean;
        timeSlots(state: { desde: Date | null; hasta: Date | null; active: 'desde' | 'hasta'; free?: boolean },
            step: number, min?: Date | null, max?: Date | null, base?: Date | null):
            { label: string; minutes: number; date: Date | null; enabled: boolean; on: boolean }[];
        pick(state: { desde: Date | null; hasta: Date | null; active: 'desde' | 'hasta'; mode?: 'rango' | 'campo' }, day: Date):
            { desde: Date | null; hasta: Date | null; active: 'desde' | 'hasta'; done: boolean };
        defaultPresets(today?: Date | null, labels?: Partial<PresetLabels>): { label: string; desde: Date; hasta: Date }[];
        today(): Date;
    }
}

declare class RangeSelector {
    constructor(el: string | HTMLElement, options?: RangeSelector.Options);
    readonly el: HTMLElement;
    getValue(): RangeSelector.Value;
    setValue(desde: DateInput, hasta: DateInput): this;
    clear(): this;
    setLimits(min: DateInput, max: DateInput): this;
    /** Parses typed input; false if there are errors. */
    validate(): boolean;
    open(field?: Field, mode?: Mode): this;
    close(refocus?: boolean): this;
    isOpen(): boolean;
    destroy(): void;

    /** Initializes the [data-range-selector] elements in `scope`. */
    static init(scope?: ParentNode): RangeSelector[];
    static utils: RangeSelector.Utils;
    static defaults: Required<Omit<RangeSelector.Options,
        'nameFrom' | 'nameTo' | 'from' | 'to' | 'empty' | 'noLimit' | 'locale'>> & { locale: RangeSelector.Options['locale'] };
    /** Spanish locale (the default). */
    static locale: RangeSelector.Locale;
    static locales: { es: RangeSelector.Locale; en: RangeSelector.Locale };
}

declare global {
    interface HTMLElement {
        rangeSelector?: RangeSelector;
    }
    interface HTMLElementEventMap {
        'rangeselector:change': CustomEvent<RangeSelector.Value>;
    }
}

export = RangeSelector;
export as namespace RangeSelector;
