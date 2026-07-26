"use client";

import { Camera, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatHHh, type ComputedSchedule } from "@/lib/schedule";
import { resolveSinopseAD } from "@/lib/scene-sinopse";
import { RESET_LABEL } from "@/lib/shots-shared";

import type { SceneTimeRow, ShotSummary } from "./types";

function MinutesCell({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Input
      type="number"
      className="h-8 w-16"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    />
  );
}

function scheduleLabel(schedule: ComputedSchedule | null): string {
  if (!schedule) return "—";
  return `Prep: ${formatHHh(schedule.prepStart)} às ${formatHHh(schedule.prepEnd)} · Rod: ${formatHHh(
    schedule.rodStart
  )} às ${formatHHh(schedule.rodEnd)}`;
}

type TakeField = "takesPrevistos" | "duracaoTakeMin" | "tempoSetupMin";

function ShotLine({
  shot,
  projectId,
  sceneId,
  onSaved,
}: {
  shot: ShotSummary;
  projectId: string;
  sceneId: string;
  onSaved: (shots: ShotSummary[]) => void;
}) {
  async function handleFieldBlur(field: TakeField, e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      // Campos numéricos aqui não são nullable no schema (takesPrevistos/duracaoTakeMin/
      // tempoSetupMin) — não há PATCH válido pra "vazio", só reverte o input pro valor salvo.
      e.target.value = String(shot[field]);
      return;
    }
    const value = Number(raw);
    if (Number.isNaN(value) || value === shot[field]) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/shots/${shot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
        return;
      }
      const shots = (await res.json()) as ShotSummary[];
      onSaved(shots);
    } catch {
      toast.error("Erro ao salvar — tente novamente");
    }
  }

  return (
    <div className="flex items-center gap-1.5 py-1 text-xs">
      <span className="shrink-0 font-medium">→ P{shot.numero}:</span>
      <span className="w-28 shrink-0 truncate text-muted-foreground">{shot.tamanho ?? "—"}</span>
      <span className="shrink-0 text-muted-foreground">·</span>
      <div className="flex shrink-0 items-center gap-1">
        <Input
          type="number"
          className="h-7 w-11 px-1 text-center"
          defaultValue={shot.takesPrevistos}
          onBlur={(e) => handleFieldBlur("takesPrevistos", e)}
        />
        <span className="text-muted-foreground">×</span>
        <Input
          type="number"
          className="h-7 w-11 px-1 text-center"
          defaultValue={shot.duracaoTakeMin}
          onBlur={(e) => handleFieldBlur("duracaoTakeMin", e)}
        />
        <span className="text-muted-foreground">+</span>
        <Input
          type="number"
          className="h-7 w-11 px-1 text-center"
          defaultValue={shot.tempoSetupMin}
          onBlur={(e) => handleFieldBlur("tempoSetupMin", e)}
        />
        <span className="shrink-0 text-muted-foreground">= {shot.tempoTotalMin}min</span>
      </div>
      {shot.tipoReset !== "NENHUM" && (
        <span className="shrink-0 text-amber-700">
          {RESET_LABEL[shot.tipoReset]} +{shot.tempoResetMin ?? 0}min
        </span>
      )}
    </div>
  );
}

export function SceneTimeRowItem({
  row,
  schedule,
  projectId,
  onRowChange,
  onShotsUpdated,
}: {
  row: SceneTimeRow;
  schedule: ComputedSchedule | null;
  projectId: string;
  onRowChange: (sceneId: string, patch: Partial<Pick<SceneTimeRow, "prepMin" | "rodMin">>) => void;
  onShotsUpdated: (sceneId: string, shots: ShotSummary[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasShots = (row.shots?.length ?? 0) > 0;

  async function handleSinopseADBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    if (value === (row.sinopseAD ?? "")) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${row.sceneId}/sinopse-ad`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinopseAD: value === "" ? null : value }),
      });
      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
      }
    } catch {
      toast.error("Erro ao salvar — tente novamente");
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-semibold">
          <div className="flex items-center gap-1">
            {hasShots && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={expanded ? "Recolher planos" : "Expandir planos"}
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
            {row.numero}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{row.setLocacaoDisplay}</TableCell>
        <TableCell className="max-w-64 truncate text-muted-foreground" title={row.sinopse ?? undefined}>
          {row.sinopse ?? "—"}
        </TableCell>
        <TableCell>
          <Textarea
            className="h-8 min-h-8 w-48 resize-y py-1 text-xs"
            defaultValue={row.sinopseAD ?? ""}
            placeholder={resolveSinopseAD(row)}
            onBlur={handleSinopseADBlur}
          />
        </TableCell>
        <TableCell>
          <MinutesCell value={row.prepMin} onChange={(v) => onRowChange(row.sceneId, { prepMin: v })} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <MinutesCell value={row.rodMin} onChange={(v) => onRowChange(row.sceneId, { rodMin: v })} />
            {row.shotsTotal && (
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Tempo calculado a partir dos planos"
                >
                  <Camera className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent>
                  Calculado a partir de {row.shotsTotal.count} plano{row.shotsTotal.count === 1 ? "" : "s"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{scheduleLabel(schedule)}</TableCell>
      </TableRow>
      {expanded && hasShots && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 py-1.5">
            <div className="space-y-0.5 pl-6">
              {row.shots!.map((shot) => (
                <ShotLine
                  key={shot.id}
                  shot={shot}
                  projectId={projectId}
                  sceneId={row.sceneId}
                  onSaved={(shots) => onShotsUpdated(row.sceneId, shots)}
                />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
