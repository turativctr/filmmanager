"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";

import type { ActualData } from "./types";

export function ActualRow({ projectId, actual }: { projectId: string; actual: ActualData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/budget/actuals/${actual.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/projects/${projectId}/budget/actuals/${actual.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <TableRow className={saving ? "opacity-60" : undefined}>
      <TableCell>
        <Input
          type="date"
          defaultValue={actual.data.slice(0, 10)}
          className="h-7 w-36 text-xs"
          onBlur={(e) => e.target.value && patch({ data: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <Input
          defaultValue={actual.descricao}
          className="h-7 min-w-[10rem] text-xs"
          onBlur={(e) => e.target.value !== actual.descricao && patch({ descricao: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="any"
          defaultValue={actual.valor}
          className="h-7 w-24 text-xs"
          onBlur={(e) => patch({ valor: Number(e.target.value) || 0 })}
        />
      </TableCell>
      <TableCell>
        <ConfirmDeleteDialog
          title={`Excluir lançamento "${actual.descricao}"?`}
          description="Remove o lançamento de gasto real. Não pode ser desfeita."
          onConfirm={handleDelete}
        />
      </TableCell>
    </TableRow>
  );
}
