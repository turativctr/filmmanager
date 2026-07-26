"use client";

import { RotateCcw } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  computeBlockSchedule,
  formatHHh,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  type ComputedSchedule,
} from "@/lib/schedule";

import { SceneTimeRowItem } from "./scene-time-row";
import type { SceneTimeRow, ShotSummary } from "./types";

function BlocoTable({
  rows,
  schedule,
  projectId,
  onRowChange,
  onShotsUpdated,
}: {
  rows: SceneTimeRow[];
  schedule: (ComputedSchedule | null)[];
  projectId: string;
  onRowChange: (sceneId: string, patch: Partial<Pick<SceneTimeRow, "prepMin" | "rodMin">>) => void;
  onShotsUpdated: (sceneId: string, shots: ShotSummary[]) => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cena</TableHead>
            <TableHead>Set</TableHead>
            <TableHead>Sinopse</TableHead>
            <TableHead>Sinopse AD</TableHead>
            <TableHead>Prep (min)</TableHead>
            <TableHead>Rod (min)</TableHead>
            <TableHead>Horário calculado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <SceneTimeRowItem
              key={row.sceneId}
              row={row}
              schedule={schedule[index]}
              projectId={projectId}
              onRowChange={onRowChange}
              onShotsUpdated={onShotsUpdated}
            />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma cena neste bloco.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function Step2Tempos({
  rows,
  blocoManhaInicio,
  almocoInicio,
  almocoFim,
  blocoTardeInicio,
  projectId,
  onRowChange,
  onDistribuir,
  onShotsUpdated,
}: {
  rows: SceneTimeRow[];
  blocoManhaInicio: string | null;
  almocoInicio: string | null;
  almocoFim: string | null;
  blocoTardeInicio: string | null;
  projectId: string;
  onRowChange: (sceneId: string, patch: Partial<Pick<SceneTimeRow, "prepMin" | "rodMin">>) => void;
  onDistribuir: () => void;
  onShotsUpdated: (sceneId: string, shots: ShotSummary[]) => void;
}) {
  const manhaRows = useMemo(
    () => rows.filter((r) => r.bloco === "MANHA").sort((a, b) => a.ordem - b.ordem),
    [rows]
  );
  const tardeRows = useMemo(
    () => rows.filter((r) => r.bloco === "TARDE").sort((a, b) => a.ordem - b.ordem),
    [rows]
  );

  const manhaSchedule = useMemo(
    () =>
      computeBlockSchedule(
        blocoManhaInicio,
        manhaRows.map((r) => ({
          prepMin: resolveEffectivePrepMin(r.prepMin),
          rodMin: resolveEffectiveRodMin(r.rodMin, r.tempoEstimadoMin),
        }))
      ),
    [blocoManhaInicio, manhaRows]
  );
  const tardeSchedule = useMemo(
    () =>
      computeBlockSchedule(
        blocoTardeInicio,
        tardeRows.map((r) => ({
          prepMin: resolveEffectivePrepMin(r.prepMin),
          rodMin: resolveEffectiveRodMin(r.rodMin, r.tempoEstimadoMin),
        }))
      ),
    [blocoTardeInicio, tardeRows]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Tempos do dia</h4>
        <Button type="button" variant="outline" size="sm" onClick={onDistribuir}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Distribuir tempos automaticamente
        </Button>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Bloco manhã</p>
        <BlocoTable
          rows={manhaRows}
          schedule={manhaSchedule}
          projectId={projectId}
          onRowChange={onRowChange}
          onShotsUpdated={onShotsUpdated}
        />
      </div>

      {(almocoInicio || almocoFim) && (
        <div className="rounded-md border border-dashed px-3 py-1.5 text-center text-xs text-muted-foreground">
          Almoço: {almocoInicio && formatHHh(almocoInicio)}
          {almocoInicio && almocoFim && " às "}
          {almocoFim && formatHHh(almocoFim)}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Bloco tarde</p>
        <BlocoTable
          rows={tardeRows}
          schedule={tardeSchedule}
          projectId={projectId}
          onRowChange={onRowChange}
          onShotsUpdated={onShotsUpdated}
        />
      </div>
    </div>
  );
}
