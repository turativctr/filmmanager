"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import { ExtraFormDialog } from "@/components/extras/extra-form-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { naturalCompare } from "@/lib/natural-sort";
import { formatTimeValue } from "@/lib/time";

type SceneOption = { id: string; numero: string };

type ExtraRow = {
  id: string;
  personagem: string;
  quantidade: number;
  chamada: unknown;
  saida: unknown;
  cenas: { sceneId: string; scene: { numero: string } }[];
};

export function ExtrasTable({
  projectId,
  extras,
  scenes,
}: {
  projectId: string;
  extras: ExtraRow[];
  scenes: SceneOption[];
}) {
  const router = useRouter();

  async function handleDelete(extraId: string) {
    await fetch(`/api/projects/${projectId}/extras/${extraId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Personagem</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Cenas</TableHead>
          <TableHead>Chamada</TableHead>
          <TableHead>Saída</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {extras.map((extra) => {
          const sceneNumbers = extra.cenas.map((c) => c.scene.numero).sort(naturalCompare);

          return (
            <TableRow key={extra.id}>
              <TableCell className="font-medium">{extra.personagem}</TableCell>
              <TableCell>{extra.quantidade}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {sceneNumbers.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    sceneNumbers.map((numero) => (
                      <Badge key={numero} variant="secondary">
                        {numero}
                      </Badge>
                    ))
                  )}
                </div>
              </TableCell>
              <TableCell>{formatTimeValue(extra.chamada) || "—"}</TableCell>
              <TableCell>{formatTimeValue(extra.saida) || "—"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <ExtraFormDialog
                    projectId={projectId}
                    scenes={scenes}
                    extra={extra}
                    trigger={
                      <Button variant="ghost" size="icon" title="Editar figuração">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <ConfirmDeleteDialog
                    title={`Excluir ${extra.personagem}?`}
                    description="Essa ação remove a figuração e seus vínculos com cenas. Não pode ser desfeita."
                    onConfirm={() => handleDelete(extra.id)}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
