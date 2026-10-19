import type { DailyPoint } from "@/lib/api/types";
import type { Formatters } from "@/lib/format";

/** Para periodos longos agrupa por semana: mantem as barras finas e legiveis. */
export interface Bucket {
  key: string;
  label: string;
  inUnits: number;
  outUnits: number;
  inventoryValue: number;
}

export function bucketize(series: DailyPoint[], f: Formatters): Bucket[] {
  if (series.length <= 31) {
    return series.map((p) => ({ key: p.date, label: f.dayMonth(p.date), inUnits: p.inUnits, outUnits: p.outUnits, inventoryValue: p.inventoryValue }));
  }
  const buckets: Bucket[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const week = series.slice(i, i + 7);
    buckets.push({
      key: week[0].date,
      label: f.dayMonth(week[0].date),
      inUnits: week.reduce((sum, p) => sum + p.inUnits, 0),
      outUnits: week.reduce((sum, p) => sum + p.outUnits, 0),
      inventoryValue: week[week.length - 1].inventoryValue, // valor ao fim da semana
    });
  }
  return buckets;
}
