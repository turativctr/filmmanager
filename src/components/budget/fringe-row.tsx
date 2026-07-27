"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/budget-calc";

import { FRINGE_TYPE_LABEL } from "./types";
import type { AccountGroupData, FringeData } from "./types";

function describeAplicaEm(aplicaEm: string[], accountGroups: AccountGroupData[]): string {
  if (aplicaEm.length === 0) return "—";
  const labels = aplicaEm.map((id) => {
    const group = accountGroups.find((g) => g.id === id);
    if (group) return group.codigo;
    for (const g of accountGroups) {
      const account = g.accounts.find((a) => a.id === id);
      if (account) return account.codigo;
    }
    return id;
  });
  return labels.join(", ");
}

export function FringeRow({
  projectId,
  fringe,
  accountGroups,
  moedaBase,
}: {
  projectId: string;
  fringe: FringeData;
  accountGroups: AccountGroupData[];
  moedaBase: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/budget/fringes/${fringe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/projects/${projectId}/budget/fringes/${fringe.id}`, { method: "DELETE" });
    router.refresh();
  }

  const totalValor = fringe.fringeLineItems.reduce((sum, f) => sum + f.valor, 0);

  return (
    <TableRow className={saving ? "opacity-60" : undefined}>
      <TableCell className="font-medium">{fringe.nome}</TableCell>
      <TableCell>
        <Input
          type="number"
          step="any"
          defaultValue={fringe.percentual}
          className="h-7 w-16 text-xs"
          onBlur={(e) => patch({ percentual: Number(e.target.value) || 0 })}
        />
        %
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="any"
          defaultValue={fringe.teto ?? ""}
          placeholder="—"
          className="h-7 w-24 text-xs"
          onBlur={(e) => patch({ teto: e.target.value ? Number(e.target.value) : null })}
        />
      </TableCell>
      <TableCell className="text-sm">{FRINGE_TYPE_LABEL[fringe.tipo]}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {describeAplicaEm(fringe.aplicaEm, accountGroups)}
      </TableCell>
      <TableCell className="text-right text-sm font-medium">{formatCurrency(totalValor, moedaBase)}</TableCell>
      <TableCell>
        <ConfirmDeleteDialog
          title={`Excluir ${fringe.nome}?`}
          description="Remove o encargo e os cálculos vinculados. Não pode ser desfeita."
          onConfirm={handleDelete}
        />
      </TableCell>
    </TableRow>
  );
}
