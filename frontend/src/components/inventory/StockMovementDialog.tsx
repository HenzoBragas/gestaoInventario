import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import type { InventoryItem } from "@/lib/inventory-store";

interface Props {
  item: InventoryItem;
  onAdjust: (id: string, delta: number) => void;
}

export function StockMovementDialog({ item, onAdjust }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [type, setType] = useState<"in" | "out">("in");

  const handleConfirm = () => {
    const delta = type === "in" ? amount : -amount;
    onAdjust(item.id, delta);
    setAmount(1);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><ArrowUpDown className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Movimentação — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">Estoque atual: <span className="font-semibold text-foreground">{item.quantity}</span></p>
          <div className="flex gap-2">
            <Button variant={type === "in" ? "default" : "outline"} className="flex-1" onClick={() => setType("in")}>Entrada</Button>
            <Button variant={type === "out" ? "destructive" : "outline"} className="flex-1" onClick={() => setType("out")}>Saída</Button>
          </div>
          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={handleConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
