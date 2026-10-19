import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleCheck,
  CircleOff,
  CircleSlash,
  SlidersHorizontal,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MovementType, StockStatus } from "@/lib/api/types";
import { MOVEMENT_LABEL, STATUS_LABEL, STATUS_RULE } from "@/lib/domain";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<StockStatus, { icon: LucideIcon; className: string }> = {
  IN_STOCK: { icon: CircleCheck, className: "bg-success/10 text-success border-success/20" },
  LOW_STOCK: {
    icon: TriangleAlert,
    className: "bg-warning/15 text-warning-foreground border-warning/30 dark:text-warning",
  },
  OUT_OF_STOCK: { icon: CircleSlash, className: "bg-destructive/10 text-destructive border-destructive/20" },
  INACTIVE: { icon: CircleOff, className: "bg-muted text-muted-foreground border-border" },
};

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium";

/** Status sempre com icone + texto (nunca apenas cor) e a regra no tooltip. */
export function StatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const { icon: Icon, className: style } = STATUS_STYLE[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(pill, style, className)} tabIndex={0}>
          <Icon className="h-3 w-3" aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{STATUS_RULE[status]}</TooltipContent>
    </Tooltip>
  );
}

const MOVEMENT_STYLE: Record<MovementType, { icon: LucideIcon; className: string }> = {
  IN: { icon: ArrowDownLeft, className: "bg-viz-in/10 text-viz-in border-viz-in/25" },
  OUT: { icon: ArrowUpRight, className: "bg-viz-out/10 text-viz-out border-viz-out/25" },
  TRANSFER: { icon: ArrowLeftRight, className: "bg-muted text-foreground border-border" },
  ADJUSTMENT: { icon: SlidersHorizontal, className: "bg-info/10 text-info border-info/25" },
};

export function MovementTypeBadge({ type, className }: { type: MovementType; className?: string }) {
  const { icon: Icon, className: style } = MOVEMENT_STYLE[type];
  return (
    <span className={cn(pill, style, className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {MOVEMENT_LABEL[type]}
    </span>
  );
}

export function MovementTypeIcon({ type, className }: { type: MovementType; className?: string }) {
  const { icon: Icon, className: style } = MOVEMENT_STYLE[type];
  return (
    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", style, className)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(pill, active ? "border-success/20 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground")}>
      {active ? <CircleCheck className="h-3 w-3" aria-hidden="true" /> : <CircleOff className="h-3 w-3" aria-hidden="true" />}
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
