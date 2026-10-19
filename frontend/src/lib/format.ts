import { useMemo } from "react";
import { useSettings } from "@/lib/api/hooks";

export interface Formatters {
  money: (value: number | null | undefined) => string;
  moneyCompact: (value: number | null | undefined) => string;
  number: (value: number | null | undefined) => string;
  compact: (value: number | null | undefined) => string;
  /** Variacao com sinal (+12%). */
  percent: (value: number) => string;
  /** Proporcao sem sinal (45%). */
  ratio: (value: number) => string;
  date: (iso: string | null | undefined) => string;
  dateTime: (iso: string | null | undefined) => string;
  dayMonth: (isoDate: string) => string;
  relative: (iso: string | null | undefined) => string;
}

const DEFAULTS = { locale: "pt-BR", currency: "BRL", timeZone: "America/Sao_Paulo" };

export function createFormatters(locale: string, currency: string, timeZone: string): Formatters {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const moneyCompact = new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const ratio = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone });
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone });
  // Datas "YYYY-MM-DD" (sem hora) ja estao no fuso da organizacao: formatar em UTC evita deslocar o dia.
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: "UTC" });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  return {
    money: (v) => (v == null ? "—" : money.format(v)),
    moneyCompact: (v) => (v == null ? "—" : moneyCompact.format(v)),
    number: (v) => (v == null ? "—" : number.format(v)),
    compact: (v) => (v == null ? "—" : compact.format(v)),
    percent: (v) => percent.format(v),
    ratio: (v) => ratio.format(v),
    date: (iso) => (iso ? date.format(new Date(iso)) : "—"),
    dateTime: (iso) => (iso ? dateTime.format(new Date(iso)) : "—"),
    dayMonth: (isoDate) => dayMonth.format(new Date(`${isoDate}T00:00:00Z`)).replace(".", ""),
    relative: (iso) => {
      if (!iso) return "—";
      const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
      const abs = Math.abs(seconds);
      if (abs < 60) return relative.format(Math.round(seconds), "second");
      if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
      if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
      if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), "day");
      return date.format(new Date(iso));
    },
  };
}

/** Formatadores alinhados a moeda, formato regional e fuso configurados pela organizacao. */
export function useFormatters(): Formatters {
  const { data } = useSettings();
  const locale = data?.locale ?? DEFAULTS.locale;
  const currency = data?.currency ?? DEFAULTS.currency;
  const timeZone = data?.timeZone ?? DEFAULTS.timeZone;
  return useMemo(() => createFormatters(locale, currency, timeZone), [locale, currency, timeZone]);
}

/** Variacao percentual entre periodos; null quando nao ha base de comparacao. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}
