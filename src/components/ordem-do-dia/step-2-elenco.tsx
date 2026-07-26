"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CREW_CALL_DEPARTMENTS } from "@/lib/report-constants";

import type { CastRow, ExtraRow } from "./types";

function TimeCell({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <Input
      type="time"
      className="h-8 w-28"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Step2Elenco({
  castRows,
  onCastChange,
  onRecalcularTodos,
  extraRows,
  onExtraChange,
  chamadaEquipe,
  onChamadaEquipeChange,
}: {
  castRows: CastRow[];
  onCastChange: (id: string, patch: Partial<Pick<CastRow, "chamada" | "camarim" | "set" | "saida">>) => void;
  onRecalcularTodos: () => void;
  extraRows: ExtraRow[];
  onExtraChange: (id: string, patch: Partial<Pick<ExtraRow, "chamada" | "saida">>) => void;
  chamadaEquipe: Record<string, string>;
  onChamadaEquipeChange: (departamento: string, valor: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Elenco presente</h4>
          <Button type="button" variant="outline" size="sm" onClick={onRecalcularTodos}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Recalcular todos
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Personagem</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Cenas</TableHead>
                <TableHead>Chegada</TableHead>
                <TableHead>Camarim</TableHead>
                <TableHead>Set</TableHead>
                <TableHead>Saída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {castRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.idCurto}</TableCell>
                  <TableCell>{row.personagem}</TableCell>
                  <TableCell className="text-muted-foreground">{row.ator ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.cenas.join(", ")}</TableCell>
                  <TableCell>
                    <TimeCell value={row.chamada} onChange={(v) => onCastChange(row.id, { chamada: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.camarim} onChange={(v) => onCastChange(row.id, { camarim: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.set} onChange={(v) => onCastChange(row.id, { set: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.saida} onChange={(v) => onCastChange(row.id, { saida: v })} />
                  </TableCell>
                </TableRow>
              ))}
              {castRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum personagem escalado nas cenas do dia.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Figuração presente</h4>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personagem</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Chamada</TableHead>
                <TableHead>Saída</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extraRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.personagem}</TableCell>
                  <TableCell>{row.quantidade}</TableCell>
                  <TableCell>
                    <TimeCell value={row.chamada} onChange={(v) => onExtraChange(row.id, { chamada: v })} />
                  </TableCell>
                  <TableCell>
                    <TimeCell value={row.saida} onChange={(v) => onExtraChange(row.id, { saida: v })} />
                  </TableCell>
                </TableRow>
              ))}
              {extraRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma figuração vinculada às cenas do dia.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Chamada equipe</h4>
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          {CREW_CALL_DEPARTMENTS.map((dept) => (
            <div key={dept} className="space-y-1">
              <Label className="text-xs">{dept}</Label>
              {["Equipe Extra", "Pós-Produção"].includes(dept) && !chamadaEquipe[dept] ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <Input
                  type="time"
                  className="h-8"
                  value={chamadaEquipe[dept] ?? ""}
                  onChange={(e) => onChamadaEquipeChange(dept, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
