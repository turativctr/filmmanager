"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FdxScene, FusionSuggestion } from "@/lib/fdx-parser";
import { formatPaginas } from "@/lib/paginas";
import { cn } from "@/lib/utils";

const NAO_DETECTADO_TITLE = "Não detectado — preencha após importar";
const PERIODO_INDEFINIDO_TITLE = "Período não reconhecido ou dependente de herança — confira antes de importar";

function UncertainCell({
  value,
  uncertain,
  title = NAO_DETECTADO_TITLE,
}: {
  value: string;
  uncertain: boolean;
  title?: string;
}) {
  return (
    <TableCell className={cn(uncertain && "bg-amber-100 text-amber-900")} title={uncertain ? title : undefined}>
      {value}
    </TableCell>
  );
}

/** Nome de exibição pro local de uma cena — mostra "Locação · Set" só quando os dois diferem
 *  (convenção "LOCAL; SET" no cabeçalho, ver fdx-parser.ts); sem ";" no cabeçalho os dois valores
 *  já chegam iguais, então mostrar só um evita redundância tipo "CARRO · CARRO". */
function localDisplay(scene: Pick<FdxScene, "set" | "locacaoNome">): string {
  if (!scene.set) return scene.locacaoNome ?? "—";
  if (!scene.locacaoNome || scene.locacaoNome === scene.set) return scene.set;
  return `${scene.locacaoNome} · ${scene.set}`;
}

export function FdxScenePreview({
  scenes,
  avisos,
  sugestoesFusao,
  onToggleScene,
  onAcceptFusion,
}: {
  scenes: (FdxScene & { selected: boolean })[];
  avisos: string[];
  sugestoesFusao?: FusionSuggestion[];
  onToggleScene: (numero: string) => void;
  onAcceptFusion?: (setName: string, locacaoNome: string, cenasSolto: string[]) => void;
}) {
  const totalPersonagens = new Set(scenes.flatMap((s) => s.personagens)).size;
  const totalPaginas = scenes.reduce((sum, s) => sum + s.paginas, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {scenes.length} {scenes.length === 1 ? "cena" : "cenas"} · {totalPersonagens}{" "}
        {totalPersonagens === 1 ? "personagem" : "personagens"} · {formatPaginas(totalPaginas)}{" "}
        {totalPaginas === 1 ? "página" : "páginas"}
      </p>

      {avisos.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">
            Este roteiro usa uma formatação não padrão. Verifique os dados antes de importar.
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </div>
      )}

      {sugestoesFusao && sugestoesFusao.length > 0 && (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">
            Sets possivelmente duplicados — mesmo nome aparece solto e dentro de outra locação. Roteiro é
            inconsistente por natureza; confirme antes de unificar.
          </p>
          <ul className="mt-2 space-y-2">
            {sugestoesFusao.map((s) =>
              s.aninhadoEm.map((parent) => (
                <li key={`${s.set}::${parent.locacaoNome}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{s.set}</strong> aparece solto (cenas {s.cenasSolto.join(", ")}) e dentro de{" "}
                    <strong>{parent.locacaoNome}</strong> (cenas {parent.cenas.join(", ")})
                  </span>
                  {onAcceptFusion && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-blue-400 bg-white hover:bg-blue-100"
                      onClick={() => onAcceptFusion(s.set, parent.locacaoNome, s.cenasSolto)}
                    >
                      Unificar com {parent.locacaoNome}
                    </Button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <div className="max-h-[45vh] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Nº</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Personagens</TableHead>
              <TableHead>Oitavas</TableHead>
              <TableHead>Tempo (min)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenes.map((scene) => (
              <TableRow key={scene.numero}>
                <TableCell>
                  <Checkbox
                    checked={scene.selected}
                    onCheckedChange={() => onToggleScene(scene.numero)}
                  />
                </TableCell>
                <UncertainCell value={scene.numero} uncertain={scene.numeroGerado} />
                <UncertainCell value={scene.tipo ?? "—"} uncertain={scene.tipo == null} />
                <TableCell className="max-w-[200px] truncate" title={localDisplay(scene)}>
                  {localDisplay(scene)}
                </TableCell>
                <UncertainCell
                  value={scene.periodo ?? "—"}
                  uncertain={scene.classeLuz === "INDEFINIDO"}
                  title={PERIODO_INDEFINIDO_TITLE}
                />
                <TableCell className="max-w-[200px] truncate">
                  {scene.personagens.length > 0
                    ? scene.personagens
                        .map((nome) => (scene.personagensSemFala?.includes(nome) ? `${nome} (sem fala)` : nome))
                        .join(", ")
                    : "—"}
                </TableCell>
                <TableCell>{formatPaginas(scene.paginas)}</TableCell>
                <TableCell>{scene.tempoEstimadoMinSugerido}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
