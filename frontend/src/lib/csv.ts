/**
 * CSV no mesmo formato da exportacao do servidor (separador ";", BOM UTF-8, protecao contra
 * formulas). Usado para exportar apenas as linhas selecionadas, que ja estao na tela.
 */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    let text = String(value);
    if (typeof value !== "number" && /^[=+\-@]/.test(text)) text = `'${text}`;
    if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const content = "﻿" + [header, ...rows].map((row) => row.map(escape).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Decimal com virgula, como na exportacao do servidor. */
export const csvDecimal = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : value.toFixed(2).replace(".", ",");
