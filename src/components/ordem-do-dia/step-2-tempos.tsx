"use client";

import { Clock, RotateCcw } from "lucide-react";
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
import { intercalar, scheduleDaTimeline, type BlocoDeTempo, type ItemTimeline } from "@/lib/day-timeline";
import {
  formatHHh,
  resolveEffectivePrepMin,
  resolveEffectiveRodMin,
  type ComputedSchedule,
} from "@/lib/schedule";

import { SceneTimeRowItem } from "./scene-time-row";
import type { SceneTimeRow, ShotSummary } from "./types";

function BlocoTable({
  itens,
  schedule,
  projectId,
  onRowChange,
  onShotsUpdated,
}: {
  /** Cenas e blocos de tempo livres do bloco (manhã ou tarde), na ordem; `schedule` é paralelo. */
  itens: ItemTimeline<SceneTimeRow>[];
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
          {itens.map((item, index) =>
            item.tipo === "cena" ? (
              <SceneTimeRowItem
                key={item.cena.sceneId}
                row={item.cena}
                schedule={schedule[index]}
                projectId={projectId}
                onRowChange={onRowChange}
                onShotsUpdated={onShotsUpdated}
              />
            ) : (
              // Bloco de tempo: só rótulo, duração e horário — posição e duração se editam no stripboard.
              <TableRow key={item.bloco.id} className="bg-muted/40">
                <TableCell colSpan={5} className="text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {item.bloco.rotulo}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{item.bloco.duracaoMin}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {schedule[index]
                    ? `${formatHHh(schedule[index]!.rodStart)} às ${formatHHh(schedule[index]!.rodEnd)}`
                    : "—"}
                </TableCell>
              </TableRow>
            )
          )}
          {itens.length === 0 && (
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
  blocos = [],
}: {
  rows: SceneTimeRow[];
  /** Blocos de tempo livres da diária (transporte etc.), intercalados com as cenas pela ordem. */
  blocos?: BlocoDeTempo[];
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

  const scheduleDaCena = (r: SceneTimeRow) => ({
    prepMin: resolveEffectivePrepMin(r.prepMin),
    rodMin: resolveEffectiveRodMin(r.rodMin, r.tempoEstimadoMin),
  });
  const manhaItens = useMemo(() => intercalar(manhaRows, blocos.filter((b) => b.bloco === "MANHA")), [manhaRows, blocos]);
  const tardeItens = useMemo(() => intercalar(tardeRows, blocos.filter((b) => b.bloco === "TARDE")), [tardeRows, blocos]);
  const manhaSchedule = useMemo(
    () => scheduleDaTimeline(blocoManhaInicio, manhaItens, scheduleDaCena),
    [blocoManhaInicio, manhaItens]
  );
  const tardeSchedule = useMemo(
    () => scheduleDaTimeline(blocoTardeInicio, tardeItens, scheduleDaCena),
    [blocoTardeInicio, tardeItens]
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
          itens={manhaItens}
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
          itens={tardeItens}
          schedule={tardeSchedule}
          projectId={projectId}
          onRowChange={onRowChange}
          onShotsUpdated={onShotsUpdated}
        />
      </div>
    </div>
  );
}
