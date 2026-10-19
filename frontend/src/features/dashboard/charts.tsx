import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GroupTotal, TopProduct } from "@/lib/api/types";
import type { Bucket } from "@/features/dashboard/bucketize";
import type { Formatters } from "@/lib/format";

const flowConfig = {
  inUnits: { label: "Entradas", color: "var(--viz-in)" },
  outUnits: { label: "Saídas", color: "var(--viz-out)" },
} satisfies ChartConfig;

export function FlowChart({ data, f, weekly }: { data: Bucket[]; f: Formatters; weekly: boolean }) {
  return (
    <ChartContainer config={flowConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} barGap={2} barCategoryGap={data.length > 20 ? "18%" : "28%"} margin={{ left: 0, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={40} fontSize={11} tickFormatter={(v: number) => f.compact(v)} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => (weekly ? `Semana de ${label}` : String(label))}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `var(--color-${String(name)})` }} />
                    {flowConfig[name as keyof typeof flowConfig].label}
                  </span>
                  <span className="tabular font-medium text-foreground">{f.number(Number(value))} un.</span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="inUnits" fill="var(--color-inUnits)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="outUnits" fill="var(--color-outUnits)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  );
}

const valueConfig = { inventoryValue: { label: "Valor do estoque", color: "var(--viz-value)" } } satisfies ChartConfig;

export function ValueChart({ data, f }: { data: Bucket[]; f: Formatters }) {
  const values = data.map((d) => d.inventoryValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || max * 0.05;
  return (
    <ChartContainer config={valueConfig} className="aspect-auto h-56 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="value-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-inventoryValue)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-inventoryValue)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} fontSize={11} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={88}
          fontSize={11}
          domain={[Math.max(0, min - pad), max + pad]}
          tickFormatter={(v: number) => f.moneyCompact(v)}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">Valor ao fim do dia</span>
                  <span className="tabular font-medium text-foreground">{f.money(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="inventoryValue"
          stroke="var(--color-inventoryValue)"
          strokeWidth={2}
          fill="url(#value-fill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Barras horizontais de uma unica serie (uma cor), com rotulo e valor diretos. */
export function GroupBars({ data, f, metric }: { data: GroupTotal[]; f: Formatters; metric: "value" | "units" }) {
  const max = Math.max(...data.map((d) => (metric === "value" ? d.value : d.units)), 1);
  return (
    <ul className="space-y-3">
      {data.map((g) => {
        const amount = metric === "value" ? g.value : g.units;
        return (
          <li key={g.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{g.label}</span>
              <span className="tabular shrink-0 font-medium">{metric === "value" ? f.money(amount) : `${f.number(amount)} un.`}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-2 rounded-full bg-muted" tabIndex={0} aria-label={`${g.label}: ${g.products} produtos, ${g.units} unidades, ${f.money(g.value)}`}>
                  <div className="h-2 rounded-full bg-viz-value transition-[width] duration-700 ease-out" style={{ width: `${(amount / max) * 100}%` }} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {f.number(g.products)} produtos · {f.number(g.units)} un. · {f.money(g.value)}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/** Barras empilhadas entrada/saida por produto (2px de respiro entre os segmentos). */
export function TopProductsBars({ data, f, onSelect }: { data: TopProduct[]; f: Formatters; onSelect: (id: number) => void }) {
  const max = Math.max(...data.map((d) => d.inUnits + d.outUnits), 1);
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-viz-in" /> Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-viz-out" /> Saídas
        </span>
      </div>
      <ul className="space-y-2.5">
        {data.map((p) => (
          <li key={p.productId}>
            <button
              type="button"
              onClick={() => onSelect(p.productId)}
              className="group w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${p.name}: ${p.inUnits} unidades de entrada e ${p.outUnits} de saída`}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate group-hover:text-primary group-hover:underline">{p.name}</span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  <span className="text-foreground">+{f.number(p.inUnits)}</span> / −{f.number(p.outUnits)}
                </span>
              </div>
              <div className="flex h-2 gap-[2px]">
                {p.inUnits > 0 && <div className="h-2 rounded-l-full bg-viz-in last:rounded-r-full" style={{ width: `${(p.inUnits / max) * 100}%` }} />}
                {p.outUnits > 0 && <div className="h-2 rounded-r-full bg-viz-out first:rounded-l-full" style={{ width: `${(p.outUnits / max) * 100}%` }} />}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
