import { useEffect, useState } from "react";

/** Persiste as colunas ocultas por tabela (preferencia de interface, por navegador). */
export function useHiddenColumns(tableId: string, defaults: string[] = []) {
  const storageKey = `inventario:hidden-columns:${tableId}`;
  const [hidden, setHidden] = useState<string[]>(defaults);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setHidden(JSON.parse(raw) as string[]);
    } catch {
      // Usa o padrao.
    }
  }, [storageKey]);
  const update = (next: string[]) => {
    setHidden(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Preferencia so em memoria.
    }
  };
  return [hidden, update] as const;
}
