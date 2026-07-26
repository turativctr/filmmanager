"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gerarNomeArquivo } from "@/lib/filename";
import { formatPaginas } from "@/lib/paginas";

type ScheduledScene = { numero: string; paginas: number };

type ExistingReport = {
  cenasConcluidas: string[];
  paginasFilmadas: number;
  horaInicioReal: string | null;
  horaTerminoReal: string | null;
  atrasoMin: number | null;
  motivoAtraso: string | null;
  observacoes: string | null;
} | null;

export function DailyProgressReportDialog({
  projectId,
  shootDayId,
  numeroDia,
  scheduledScenes,
  initialReport,
  projeto,
}: {
  projectId: string;
  shootDayId: string;
  numeroDia: number;
  scheduledScenes: ScheduledScene[];
  initialReport: ExistingReport;
  projeto: { titulo: string; sigla: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [concluidas, setConcluidas] = useState<Set<string>>(
    new Set(initialReport?.cenasConcluidas ?? scheduledScenes.map((s) => s.numero))
  );
  const [paginasFilmadas, setPaginasFilmadas] = useState(
    initialReport?.paginasFilmadas != null
      ? String(initialReport.paginasFilmadas)
      : String(scheduledScenes.reduce((sum, s) => sum + s.paginas, 0))
  );
  const [horaInicioReal, setHoraInicioReal] = useState(initialReport?.horaInicioReal ?? "");
  const [horaTerminoReal, setHoraTerminoReal] = useState(initialReport?.horaTerminoReal ?? "");
  const [atrasoMin, setAtrasoMin] = useState(initialReport?.atrasoMin?.toString() ?? "");
  const [motivoAtraso, setMotivoAtraso] = useState(initialReport?.motivoAtraso ?? "");
  const [observacoes, setObservacoes] = useState(initialReport?.observacoes ?? "");
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleScene(numero: string) {
    setConcluidas((prev) => {
      const next = new Set(prev);
      if (next.has(numero)) next.delete(numero);
      else next.add(numero);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const cenasNaoConcluidas = scheduledScenes.map((s) => s.numero).filter((n) => !concluidas.has(n));

    const res = await fetch(`/api/projects/${projectId}/shoot-days/${shootDayId}/daily-progress-report`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cenasConcluidas: [...concluidas],
        cenasNaoConcluidas,
        paginasFilmadas: paginasFilmadas === "" ? 0 : Number(paginasFilmadas),
        horaInicioReal: horaInicioReal || undefined,
        horaTerminoReal: horaTerminoReal || undefined,
        atrasoMin: atrasoMin === "" ? undefined : Number(atrasoMin),
        motivoAtraso: motivoAtraso || undefined,
        observacoes: observacoes || undefined,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      setError("Não foi possível salvar o relatório.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/ad-documents/daily-progress-report?day=${shootDayId}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = gerarNomeArquivo({ projeto, tipo: "DPR", variante: `Diaria${numeroDia}`, ext: "pdf" });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
          Relatório de Progresso Diário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório de Progresso Diário — Diária {numeroDia}</DialogTitle>
          <DialogDescription>Confirme o que foi concluído hoje e registre atrasos/observações.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cenas previstas</Label>
            <div className="space-y-1 rounded-md border p-2">
              {scheduledScenes.map((scene) => (
                <label key={scene.numero} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={concluidas.has(scene.numero)} onCheckedChange={() => toggleScene(scene.numero)} />
                  Cena {scene.numero} ({formatPaginas(scene.paginas)})
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paginasFilmadas">Páginas filmadas</Label>
            <Input
              id="paginasFilmadas"
              type="number"
              step="0.125"
              value={paginasFilmadas}
              onChange={(e) => setPaginasFilmadas(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="horaInicioReal">Início real</Label>
              <Input
                id="horaInicioReal"
                type="time"
                value={horaInicioReal}
                onChange={(e) => setHoraInicioReal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="horaTerminoReal">Término real</Label>
              <Input
                id="horaTerminoReal"
                type="time"
                value={horaTerminoReal}
                onChange={(e) => setHoraTerminoReal(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atrasoMin">Atraso (min, negativo = adiantado)</Label>
            <Input id="atrasoMin" type="number" value={atrasoMin} onChange={(e) => setAtrasoMin(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivoAtraso">Motivo do atraso</Label>
            <Input id="motivoAtraso" value={motivoAtraso} onChange={(e) => setMotivoAtraso(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? "Gerando..." : "Baixar PDF"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
