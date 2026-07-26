"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/budget-calc";

import { PeriodoCell } from "./periodo-cell";
import type { GlobalData, LineItemData } from "./types";

const MOEDAS = ["BRL", "USD", "EUR"];

export function LineItemRow({
  projectId,
  item,
  globals,
}: {
  projectId: string;
  item: LineItemData;
  globals: GlobalData[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/budget/line-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/projects/${projectId}/budget/line-items/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <TableRow className={saving ? "opacity-60" : undefined}>
      <TableCell>
        <Input
          defaultValue={item.descricao}
          className="h-7 min-w-[10rem] text-xs"
          onBlur={(e) => e.target.value !== item.descricao && patch({ descricao: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="any"
          defaultValue={item.quantidade}
          className="h-7 w-16 text-xs"
          onBlur={(e) => patch({ quantidade: Number(e.target.value) || 0 })}
        />
      </TableCell>
      <TableCell>
        <Input
          defaultValue={item.unidade}
          className="h-7 w-20 text-xs"
          onBlur={(e) => e.target.value !== item.unidade && patch({ unidade: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <PeriodoCell
          periodo={item.periodo}
          globalRef={item.globalRef}
          globals={globals}
          onChangeGlobalRef={(globalRef) => patch({ globalRef })}
          onChangePeriodo={(periodo) => patch({ periodo })}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="any"
          defaultValue={item.taxa}
          className="h-7 w-20 text-xs"
          onBlur={(e) => patch({ taxa: Number(e.target.value) || 0 })}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <select
            className="h-7 rounded border bg-background px-1 text-xs"
            defaultValue={item.moeda}
            onChange={(e) => patch({ moeda: e.target.value })}
          >
            {MOEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {item.moeda !== "BRL" && (
            <Input
              type="number"
              step="any"
              defaultValue={item.taxaCambio}
              title="Taxa de câmbio para a moeda base"
              className="h-7 w-16 text-xs"
              onBlur={(e) => patch({ taxaCambio: Number(e.target.value) || 1 })}
            />
          )}
        </div>
      </TableCell>
      <TableCell className="text-right text-sm font-medium">{formatCurrency(item.total)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Checkbox
            checked={item.isFrengeable}
            onCheckedChange={(checked) => patch({ isFrengeable: Boolean(checked) })}
            title="Sujeito a encargos (fringeable)"
          />
          <ConfirmDeleteDialog
            title={`Excluir "${item.descricao}"?`}
            description="Essa ação remove o item do orçamento. Não pode ser desfeita."
            onConfirm={handleDelete}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
