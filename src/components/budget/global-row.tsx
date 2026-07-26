"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";

import type { GlobalData } from "./types";

export function GlobalRow({ projectId, global }: { projectId: string; global: GlobalData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleValorChange(valor: number) {
    if (valor === global.valor) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/budget/globals/${global.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor }),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    await fetch(`/api/projects/${projectId}/budget/globals/${global.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <TableRow className={saving ? "opacity-60" : undefined}>
      <TableCell className="font-mono text-sm font-medium">{global.chave}</TableCell>
      <TableCell>
        <Input
          type="number"
          step="any"
          defaultValue={global.valor}
          className="h-7 w-24 text-xs"
          onBlur={(e) => handleValorChange(Number(e.target.value) || 0)}
        />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{global.descricao || "—"}</TableCell>
      <TableCell className="text-sm">{global.afetaLinhas.length}</TableCell>
      <TableCell>
        <ConfirmDeleteDialog
          title={`Excluir ${global.chave}?`}
          description="LineItems que usam essa chave voltarão a usar o período manual salvo. Não pode ser desfeita."
          onConfirm={handleDelete}
        />
      </TableCell>
    </TableRow>
  );
}
