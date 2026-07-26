"use client";

import { useState } from "react";

import { CharacterCategoriaBadge } from "@/components/cast/character-categoria-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CastAccountingRow } from "@/lib/ad-documents-data";
import { getCharacterId } from "@/lib/character-id";
import { gerarNomeArquivo } from "@/lib/filename";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type RowState = CastAccountingRow & { diasHold: string };

export function CastAccountingTable({
  projectId,
  initialRows,
  sistemaIdElenco,
  projeto,
}: {
  projectId: string;
  initialRows: CastAccountingRow[];
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
}) {
  const [rows, setRows] = useState<RowState[]>(initialRows.map((r) => ({ ...r, diasHold: "0" })));
  const [downloading, setDownloading] = useState(false);

  function updateRow(characterId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.characterId === characterId ? { ...r, ...patch } : r)));
  }

  async function persistField(characterId: string, field: "cacheeDiario" | "percentualHold", value: string) {
    await fetch(`/api/projects/${projectId}/characters/${characterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value === "" ? null : Number(value) }),
    });
  }

  function total(row: RowState): number {
    const cachee = row.cacheeDiario ?? 0;
    const holdPct = row.percentualHold ?? 0;
    const diasHold = Number(row.diasHold) || 0;
    return row.diasTrabalhados * cachee + diasHold * cachee * (holdPct / 100);
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ad-documents/cast-accounting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diasHold: rows.map((r) => ({ characterId: r.characterId, diasHold: Number(r.diasHold) || 0 })),
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = gerarNomeArquivo({ projeto, tipo: "PrestacaoContas", ext: "pdf" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  const grandTotal = rows.reduce((sum, r) => sum + total(r), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Personagem</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>Cachê/dia (R$)</TableHead>
              <TableHead>Dias trabalhados</TableHead>
              <TableHead>Dias hold</TableHead>
              <TableHead>% Hold</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.characterId}>
                <TableCell className="font-medium">{getCharacterId(row, { sistemaIdElenco })}</TableCell>
                <TableCell>
                  <CharacterCategoriaBadge categoria={row.categoria} />
                </TableCell>
                <TableCell>{row.personagem}</TableCell>
                <TableCell>{row.ator ?? "—"}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-28"
                    value={row.cacheeDiario ?? ""}
                    onChange={(e) => updateRow(row.characterId, { cacheeDiario: e.target.value === "" ? null : Number(e.target.value) })}
                    onBlur={(e) => persistField(row.characterId, "cacheeDiario", e.target.value)}
                  />
                </TableCell>
                <TableCell>{row.diasTrabalhados}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-20"
                    value={row.diasHold}
                    onChange={(e) => updateRow(row.characterId, { diasHold: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="w-20"
                    value={row.percentualHold ?? ""}
                    onChange={(e) => updateRow(row.characterId, { percentualHold: e.target.value === "" ? null : Number(e.target.value) })}
                    onBlur={(e) => persistField(row.characterId, "percentualHold", e.target.value)}
                  />
                </TableCell>
                <TableCell className="text-right font-medium">{formatBRL(total(row))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">GRAND TOTAL: {formatBRL(grandTotal)}</p>
        <Button onClick={handleDownloadPdf} disabled={downloading}>
          {downloading ? "Gerando..." : "Baixar PDF"}
        </Button>
      </div>
    </div>
  );
}
