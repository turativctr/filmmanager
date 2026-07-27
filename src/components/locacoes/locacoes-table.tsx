"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MergeLocacoesDialog } from "@/components/locacoes/merge-locacoes-dialog";
import { NewLocacaoDialog } from "@/components/locacoes/new-locacao-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pluralize } from "@/lib/pluralize";

import type { LocacaoListRow } from "@/lib/locacao-data";

export function LocacoesTable({
  projectId,
  locacoes,
  semLocacaoCount,
}: {
  projectId: string;
  locacoes: LocacaoListRow[];
  semLocacaoCount: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLocacoes = locacoes.filter((l) => selected.has(l.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          {selected.size >= 2 && (
            <Button size="sm" onClick={() => setMergeOpen(true)}>
              Unificar ({selected.size})
            </Button>
          )}
        </div>
        <NewLocacaoDialog projectId={projectId} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead className="text-right">Nº de cenas</TableHead>
                <TableHead className="text-right">Nº de diárias</TableHead>
                <TableHead>Sets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locacoes.map((l) => (
                <TableRow key={l.id}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${projectId}/locacoes/${l.id}`} className="hover:underline">
                      {l.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground" title={l.endereco ?? undefined}>
                    {l.endereco ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">{l.numCenas}</TableCell>
                  <TableCell className="text-right">{l.numDiarias}</TableCell>
                  <TableCell>
                    {l.sets.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {l.sets.map((set) => (
                          <Badge key={set} variant="secondary" className="text-[10px]">
                            {set}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {locacoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma locação cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
              {semLocacaoCount > 0 && (
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Sem locação definida — {pluralize(semLocacaoCount, "cena")}
                  </TableCell>
                  <TableCell>
                    <Button variant="link" size="sm" asChild className="h-auto p-0">
                      <Link href={`/projects/${projectId}/scenes`}>Atribuir</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MergeLocacoesDialog
        projectId={projectId}
        locacoes={selectedLocacoes}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        onMerged={() => {
          setSelected(new Set());
          router.refresh();
        }}
      />
    </div>
  );
}
