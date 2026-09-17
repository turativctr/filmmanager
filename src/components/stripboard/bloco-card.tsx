"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BLOCO_PRESETS, ROTULO_BLOCO_MAX } from "@/lib/day-timeline";
import { formatTempoEstimado } from "@/lib/paginas";
import { formatHHh, type ComputedSchedule } from "@/lib/schedule";

import { blocoItemId, type StripBloco } from "./types";

async function salvar(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      toast.error("Erro ao salvar — tente novamente");
      return false;
    }
    return true;
  } catch {
    toast.error("Erro ao salvar — tente novamente");
    return false;
  }
}

/** Bloco de tempo livre na diária (transporte, espera de luz...) — arrastável na mesma lista das cenas,
 *  com rótulo e duração editáveis ali mesmo. Nunca mostra número de cena: não é cena. */
export function BlocoCard({
  projectId,
  shootDayId,
  bloco,
  schedule,
  onChanged,
}: {
  projectId: string;
  shootDayId: string;
  bloco: StripBloco;
  schedule: ComputedSchedule | null;
  onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: blocoItemId(bloco.id),
  });
  const [rotulo, setRotulo] = useState(bloco.rotulo);
  const [duracao, setDuracao] = useState(String(bloco.duracaoMin));

  useEffect(() => {
    setRotulo(bloco.rotulo);
    setDuracao(String(bloco.duracaoMin));
  }, [bloco.rotulo, bloco.duracaoMin]);

  const url = `/api/projects/${projectId}/shoot-days/${shootDayId}/blocos/${bloco.id}`;

  async function commit() {
    const r = rotulo.trim();
    const d = Number(duracao);
    if (!r || !Number.isInteger(d) || d < 1) {
      setRotulo(bloco.rotulo);
      setDuracao(String(bloco.duracaoMin));
      return;
    }
    if (r === bloco.rotulo && d === bloco.duracaoMin) return;
    if (await salvar(url, "PATCH", { rotulo: r, duracaoMin: d })) onChanged();
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-1 text-xs"
    >
      <button
        type="button"
        className="shrink-0 touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-label="Arrastar bloco"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Input
        aria-label="Rótulo do bloco"
        className="h-7 w-44 text-xs"
        maxLength={ROTULO_BLOCO_MAX}
        value={rotulo}
        onChange={(e) => setRotulo(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <Input
        aria-label="Duração do bloco em minutos"
        type="number"
        min={1}
        className="h-7 w-16 text-xs"
        value={duracao}
        onChange={(e) => setDuracao(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="text-muted-foreground">min</span>
      <span className="ml-auto text-muted-foreground">
        {schedule ? `${formatHHh(schedule.rodStart)} às ${formatHHh(schedule.rodEnd)}` : formatTempoEstimado(bloco.duracaoMin)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label={`Remover bloco ${bloco.rotulo}`}
        onClick={async () => {
          if (await salvar(url, "DELETE")) onChanged();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Adicionar bloco de tempo: presets (Transporte, Mudança de locação...) ou um personalizado. Entra no
 *  fim da diária; a AD arrasta pra posição. */
export function AdicionarBlocoButton({
  projectId,
  shootDayId,
  onAdded,
}: {
  projectId: string;
  shootDayId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rotulo, setRotulo] = useState("");
  const [duracao, setDuracao] = useState("30");

  async function criar(r: string, d: number) {
    if (await salvar(`/api/projects/${projectId}/shoot-days/${shootDayId}/blocos`, "POST", { rotulo: r, duracaoMin: d })) {
      setOpen(false);
      setRotulo("");
      onAdded();
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Bloco de tempo
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {BLOCO_PRESETS.map((p) => (
            <Button key={p.rotulo} variant="outline" size="sm" className="h-7 text-xs" onClick={() => void criar(p.rotulo, p.duracaoMin)}>
              {p.rotulo}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            aria-label="Rótulo do novo bloco"
            placeholder="Outro rótulo"
            maxLength={ROTULO_BLOCO_MAX}
            className="h-8 text-xs"
            value={rotulo}
            onChange={(e) => setRotulo(e.target.value)}
          />
          <Input
            aria-label="Duração do novo bloco em minutos"
            type="number"
            min={1}
            className="h-8 w-16 text-xs"
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={!rotulo.trim() || !(Number(duracao) >= 1)}
            onClick={() => void criar(rotulo.trim(), Number(duracao))}
          >
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Entra no fim da diária — arraste pra posição certa.</p>
      </PopoverContent>
    </Popover>
  );
}
