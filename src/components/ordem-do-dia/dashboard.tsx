"use client";

import type { ShootDayChecklistTipo } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Info, RefreshCw, Tablet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DailyProgressReportDialog } from "@/components/ad-documents/daily-progress-report-dialog";
import { SceneProgressPanel } from "@/components/ordem-do-dia/scene-progress-panel";
import { PageHeader } from "@/components/shared/page-header";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getCharacterId } from "@/lib/character-id";
import type { MakeEntry, QuickChangeAlert } from "@/lib/ordem-do-dia";
import { formatPaginas } from "@/lib/paginas";
import type { SceneShootDayStatusValue } from "@/lib/scene-progress";
import { minutesToTime } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type TimelineBlock = { label: string; startMin: number; durationMin: number; kind: "scene" | "pause" };

type ChecklistItem = {
  id: string;
  item: string;
  confirmado: boolean;
  tipo: ShootDayChecklistTipo;
  geradoAutomaticamente: boolean;
};

export function ShootDayDashboard({
  projectId,
  sistemaIdElenco,
  projeto,
  shootDay,
  totalCenas,
  totalPaginas,
  totalMinutos,
  totalPessoas,
  timelineBlocks,
  alerts,
  checklist: initialChecklist,
  scheduledScenes,
  initialDailyProgressReport,
  sceneProgress,
}: {
  projectId: string;
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
  projeto: { titulo: string; sigla: string | null };
  shootDay: { id: string; numeroDia: number; data: string; chamadaGeral: string | null; desprodInicio: string | null };
  totalCenas: number;
  totalPaginas: number;
  totalMinutos: number;
  totalPessoas: number;
  timelineBlocks: TimelineBlock[];
  alerts: {
    castConflicts: string[];
    quickChanges: QuickChangeAlert[];
    makeEspeciais: MakeEntry[];
    comidaCena: { texto: string; sceneNumero: string }[];
    habilidadesPendentesCount: number;
    notasPosProducao: string[];
  };
  checklist: ChecklistItem[];
  scheduledScenes: { numero: string; paginas: number }[];
  initialDailyProgressReport: {
    cenasConcluidas: string[];
    paginasFilmadas: number;
    horaInicioReal: string | null;
    horaTerminoReal: string | null;
    atrasoMin: number | null;
    motivoAtraso: string | null;
    observacoes: string | null;
  } | null;
  sceneProgress: {
    sceneId: string;
    numero: string;
    paginas: number;
    status: SceneShootDayStatusValue;
    horaInicioReal: string | null;
    horaFimReal: string | null;
  }[];
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState(initialChecklist);
  const [regenerating, setRegenerating] = useState(false);
  const [newItem, setNewItem] = useState("");

  const timelineStart = Math.min(...timelineBlocks.map((b) => b.startMin), 0);
  const timelineEnd = Math.max(...timelineBlocks.map((b) => b.startMin + b.durationMin), timelineStart + 1);
  const totalSpan = timelineEnd - timelineStart;

  const hasAnyAlert =
    alerts.castConflicts.length > 0 ||
    alerts.quickChanges.length > 0 ||
    alerts.makeEspeciais.length > 0 ||
    alerts.comidaCena.length > 0 ||
    alerts.habilidadesPendentesCount > 0;

  async function toggleConfirmado(item: ChecklistItem) {
    setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, confirmado: !c.confirmado } : c)));
    await fetch(`/api/projects/${projectId}/shoot-days/${shootDay.id}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmado: !item.confirmado }),
    });
  }

  async function deleteItem(itemId: string) {
    setChecklist((prev) => prev.filter((c) => c.id !== itemId));
    await fetch(`/api/projects/${projectId}/shoot-days/${shootDay.id}/checklist/${itemId}`, {
      method: "DELETE",
    });
  }

  async function addItem() {
    if (!newItem.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDay.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: newItem.trim(), tipo: "OUTRO" }),
    });
    if (res.ok) {
      const created = await res.json();
      setChecklist((prev) => [...prev, created]);
      setNewItem("");
    }
  }

  async function regenerate() {
    setRegenerating(true);
    await fetch(`/api/projects/${projectId}/shoot-days/${shootDay.id}/checklist/regenerate`, {
      method: "POST",
    });
    setRegenerating(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Diária ${shootDay.numeroDia} — ${new Date(shootDay.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
        actions={
          <>
            <DailyProgressReportDialog
              projectId={projectId}
              shootDayId={shootDay.id}
              numeroDia={shootDay.numeroDia}
              scheduledScenes={scheduledScenes}
              initialReport={initialDailyProgressReport}
              projeto={projeto}
            />
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/projects/${projectId}/shootdays/${shootDay.id}/set`}>
                <Tablet className="h-4 w-4" />
                Modo set
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${projectId}/shootdays/${shootDay.id}/hora-a-hora`}>Hora a Hora</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/projects/${projectId}/shootdays/${shootDay.id}/ordem-do-dia`}>Editar Ordem do Dia</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de cenas</p>
            <p className="text-2xl font-semibold">{totalCenas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Total de oitavas
              <TermTooltip content="Unidade de medida de roteiro. 1 página = 8 oitavas. Usado para estimar o tempo de filmagem de cada cena." />
            </p>
            <p className="text-2xl font-semibold">{formatPaginas(totalPaginas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tempo estimado</p>
            <p className="text-2xl font-semibold">{totalMinutos} min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pessoas no set</p>
            <p className="text-2xl font-semibold">{totalPessoas}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold">Timeline do dia</p>
          <div className="flex h-10 overflow-hidden rounded-md border">
            {timelineBlocks.map((block, i) => (
              <div
                key={`${block.label}-${i}`}
                title={`${block.label} — início ${minutesToTime(block.startMin)} — ${block.durationMin} min`}
                style={{ flexGrow: block.durationMin / totalSpan }}
                className={cn(
                  "flex min-w-[2px] items-center justify-center truncate border-r px-1 text-[10px] font-medium last:border-r-0",
                  block.kind === "pause" ? "bg-muted text-muted-foreground" : "bg-blue-100 text-blue-900"
                )}
              >
                {block.durationMin >= 30 && block.label}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <SceneProgressPanel
        projectId={projectId}
        shootDayId={shootDay.id}
        data={shootDay.data}
        chamadaGeral={shootDay.chamadaGeral}
        desprodInicio={shootDay.desprodInicio}
        initialScenes={sceneProgress}
      />

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">Alertas do dia</p>
          {!hasAnyAlert && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Dia sem conflitos.
            </p>
          )}
          {alerts.castConflicts.map((msg, i) => (
            <p key={`conflict-${i}`} className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {msg}
            </p>
          ))}
          {alerts.quickChanges.map((c, i) => (
            <p key={`change-${i}`} className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Troca de roupa rápida: {getCharacterId(c, { sistemaIdElenco })} entre cenas {c.fromScene}→{c.toScene} (
              {c.gapMin} min)
            </p>
          ))}
          {alerts.makeEspeciais.map((m, i) => (
            <p key={`make-${i}`} className="flex items-center gap-1.5 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Efeito especial de maquiagem:{" "}
              {getCharacterId(m, { sistemaIdElenco })} — {m.descricao}
            </p>
          ))}
          {alerts.comidaCena.map((c, i) => (
            <p key={`comida-${i}`} className="flex items-center gap-1.5 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Comida de cena (cena {c.sceneNumero}): {c.texto}
            </p>
          ))}
          {alerts.habilidadesPendentesCount > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {alerts.habilidadesPendentesCount} habilidade(s)
              especial(is) do elenco a confirmar.
            </p>
          )}
          {alerts.notasPosProducao.length > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-blue-700">
              <Info className="h-4 w-4 shrink-0" /> Notas de pós-produção: {alerts.notasPosProducao.join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Checklist pré-set</p>
            <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", regenerating && "animate-spin")} />
              Regenerar checklist
            </Button>
          </div>

          <div className="space-y-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <Checkbox checked={item.confirmado} onCheckedChange={() => toggleConfirmado(item)} />
                <span className={cn("flex-1 text-sm", item.confirmado && "text-muted-foreground line-through")}>
                  {item.item}
                </span>
                <span className="text-[10px] uppercase text-muted-foreground">{item.tipo}</span>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remover
                </button>
              </div>
            ))}
            {checklist.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">Nenhum item no checklist ainda.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Adicionar item manual..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addItem}>
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
