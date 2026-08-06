"use client";

import { useState } from "react";

import { MoveScenesDialog } from "@/components/locacoes/move-scenes-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { LocacaoDetailSceneRow } from "@/lib/locacao-data";

const PERIODO_LABEL: Record<string, string> = {
  DIA: "Dia",
  NOITE: "Noite",
  ENTARDECER: "Entardecer",
  AMANHECER: "Amanhecer",
  CONTINUO: "Contínuo",
  DEPOIS: "Depois",
  NOITE_PARA_DIA: "Noite para dia",
  DIA_PARA_NOITE: "Dia para noite",
};

export function LocacaoCenasSection({
  projectId,
  locacaoId,
  scenes,
  otherLocacoes,
}: {
  projectId: string;
  locacaoId: string;
  scenes: LocacaoDetailSceneRow[];
  otherLocacoes: { id: string; nome: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Cenas</CardTitle>
        {selected.size > 0 && (
          <Button size="sm" onClick={() => setMoveOpen(true)}>
            Mover para outra locação ({selected.size})
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Cena</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Set</TableHead>
              <TableHead>Sinopse</TableHead>
              <TableHead>Diária</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenes.map((scene) => (
              <TableRow key={scene.id}>
                <TableCell>
                  <Checkbox checked={selected.has(scene.id)} onCheckedChange={() => toggle(scene.id)} />
                </TableCell>
                <TableCell className="font-medium">{scene.numero}</TableCell>
                <TableCell>{scene.tipo ?? "—"}</TableCell>
                <TableCell>{scene.periodo ? PERIODO_LABEL[scene.periodo] ?? scene.periodo : "—"}</TableCell>
                <TableCell>{scene.set ?? "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate text-muted-foreground" title={scene.sinopse ?? undefined}>
                  {scene.sinopse ?? "—"}
                </TableCell>
                <TableCell>{scene.numeroDia != null ? `Diária ${scene.numeroDia}` : "Não agendada"}</TableCell>
              </TableRow>
            ))}
            {scenes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma cena vinculada a esta locação ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <MoveScenesDialog
        projectId={projectId}
        currentLocacaoId={locacaoId}
        otherLocacoes={otherLocacoes}
        selectedSceneIds={Array.from(selected)}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onMoved={() => setSelected(new Set())}
      />
    </Card>
  );
}
