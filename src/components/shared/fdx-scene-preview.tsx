"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FdxScene } from "@/lib/fdx-parser";
import { formatPaginas } from "@/lib/paginas";
import { cn } from "@/lib/utils";

const PERIODO_LABEL: Record<string, string> = {
  DIA: "Dia",
  NOITE: "Noite",
  ENTARDECER: "Entardecer",
  AMANHECER: "Amanhecer",
  CONTINUO: "Contínuo",
  DEPOIS: "Depois",
};

const NAO_DETECTADO_TITLE = "Não detectado — preencha após importar";

function UncertainCell({ value, uncertain }: { value: string; uncertain: boolean }) {
  return (
    <TableCell
      className={cn(uncertain && "bg-amber-100 text-amber-900")}
      title={uncertain ? NAO_DETECTADO_TITLE : undefined}
    >
      {value}
    </TableCell>
  );
}

export function FdxScenePreview({
  scenes,
  avisos,
  onToggleScene,
}: {
  scenes: (FdxScene & { selected: boolean })[];
  avisos: string[];
  onToggleScene: (numero: string) => void;
}) {
  return (
    <div className="space-y-3">
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
                <TableCell className="max-w-[160px] truncate" title={scene.set ?? undefined}>
                  {scene.set ?? "—"}
                </TableCell>
                <UncertainCell
                  value={scene.periodo ? PERIODO_LABEL[scene.periodo] ?? scene.periodo : "—"}
                  uncertain={scene.periodo == null}
                />
                <TableCell className="max-w-[200px] truncate">
                  {scene.personagens.length > 0 ? scene.personagens.join(", ") : "—"}
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
