"use client";

import { ClipboardList, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { SceneFormDialog } from "@/components/scenes/scene-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { TermTooltip } from "@/components/shared/term-tooltip";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type CharacterOption = {
  id: string;
  idCurto: string;
  numeroElenco: number | null;
  personagem: string;
};

type SceneRow = {
  id: string;
  numero: string;
  tipo: "INT" | "EXT" | null;
  periodo: "DIA" | "NOITE" | "ENTARDECER" | "AMANHECER" | "CONTINUO" | "DEPOIS" | null;
  set: string | null;
  locacao: string | null;
  sinopse: string | null;
  paginas: unknown;
  diaNarrativo: number | null;
  tempoEstimadoMin: number | null;
  notasAD: string | null;
  omitida: boolean;
  cast: { characterId: string }[];
};

export function ScenesTable({
  projectId,
  scenes,
  characters,
  sistemaIdElenco,
}: {
  projectId: string;
  scenes: SceneRow[];
  characters: CharacterOption[];
  sistemaIdElenco: "ID_CURTO" | "NUMERACAO";
}) {
  const router = useRouter();

  async function handleDelete(sceneId: string) {
    await fetch(`/api/projects/${projectId}/scenes/${sceneId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cena</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Período</TableHead>
          <TableHead>Set</TableHead>
          <TableHead>Locação</TableHead>
          <TableHead>Sinopse</TableHead>
          <TableHead>
            <span className="inline-flex items-center gap-1">
              Páginas
              <TermTooltip content="1 página = 8 oitavas. Usado para estimar o tempo de filmagem de cada cena." />
            </span>
          </TableHead>
          <TableHead>Dia narr.</TableHead>
          <TableHead>Tempo (min)</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scenes.map((scene) => (
          <TableRow key={scene.id} className={cn(scene.omitida && "text-muted-foreground")}>
            <TableCell className="font-medium">
              <span className={cn(scene.omitida && "line-through")}>{scene.numero}</span>
              {scene.omitida && (
                <span className="ml-1.5 rounded border border-destructive/40 bg-destructive/10 px-1 py-0.5 text-[10px] font-semibold text-destructive">
                  OMITIDA
                </span>
              )}
            </TableCell>
            <TableCell>{scene.tipo ?? "—"}</TableCell>
            <TableCell>{scene.periodo ? PERIODO_LABEL[scene.periodo] ?? scene.periodo : "—"}</TableCell>
            <TableCell>{scene.set ?? "—"}</TableCell>
            <TableCell>{scene.locacao ?? "—"}</TableCell>
            <TableCell className="max-w-[220px] truncate" title={scene.sinopse ?? undefined}>
              {scene.sinopse ?? "—"}
            </TableCell>
            <TableCell>{formatPaginas(scene.paginas)}</TableCell>
            <TableCell>{scene.diaNarrativo ?? "—"}</TableCell>
            <TableCell>{scene.tempoEstimadoMin ?? "—"}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" asChild title="Breakdown sheet">
                  <Link href={`/projects/${projectId}/scenes/${scene.id}/breakdown`}>
                    <ClipboardList className="h-4 w-4" />
                  </Link>
                </Button>
                <SceneFormDialog
                  projectId={projectId}
                  characters={characters}
                  sistemaIdElenco={sistemaIdElenco}
                  scene={scene}
                  trigger={
                    <Button variant="ghost" size="icon" title="Editar cena">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  }
                />
                <ConfirmDeleteDialog
                  title={`Excluir cena ${scene.numero}?`}
                  description="Essa ação remove a cena e todos os dados de breakdown associados. Não pode ser desfeita."
                  onConfirm={() => handleDelete(scene.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
