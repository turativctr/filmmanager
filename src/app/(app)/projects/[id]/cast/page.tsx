import { Users } from "lucide-react";
import Link from "next/link";

import { CastTable } from "@/components/cast/cast-table";
import { CharacterFormDialog } from "@/components/cast/character-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { NextStepFooter } from "@/components/shared/next-step-footer";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

export default async function CastPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semCena?: string };
}) {
  const semCenaAtivo = searchParams.semCena === "1";

  const [characters, scenes, semCenaCount] = await Promise.all([
    prisma.character.findMany({
      where: { projectId: params.id, ...(semCenaAtivo ? { scenes: { none: {} } } : {}) },
      include: { scenes: { include: { scene: { select: { numero: true } } } } },
    }),
    prisma.scene.findMany({
      where: { projectId: params.id },
      select: { id: true, numero: true },
    }),
    prisma.character.count({ where: { projectId: params.id, scenes: { none: {} } } }),
  ]);

  const sortedCharacters = [...characters].sort(
    (a, b) => (a.numeroElenco ?? Infinity) - (b.numeroElenco ?? Infinity) || naturalCompare(a.idCurto, b.idCurto)
  );
  const sortedScenes = [...scenes].sort((a, b) => naturalCompare(a.numero, b.numero));

  return (
    <div className="space-y-4">
      <PageHeader title="Elenco" actions={<CharacterFormDialog projectId={params.id} scenes={sortedScenes} />} />

      {sortedCharacters.length === 0 ? (
        <EmptyState
          icon={Users}
          title={semCenaAtivo ? "Nenhum personagem sem cena vinculada" : "Nenhum personagem cadastrado ainda"}
          description={
            semCenaAtivo
              ? "Todos os personagens já têm cena vinculada."
              : "Importe o roteiro para detectar personagens automaticamente, ou cadastre manualmente."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <CastTable projectId={params.id} characters={sortedCharacters} scenes={sortedScenes} />
          </CardContent>
        </Card>
      )}

      {semCenaCount > 0 && (
        <NextStepFooter>
          <Link
            href={`/projects/${params.id}/cast${semCenaAtivo ? "" : "?semCena=1"}`}
            className="hover:text-foreground hover:underline"
          >
            {semCenaAtivo
              ? "Mostrar todos os personagens"
              : `${semCenaCount} ${semCenaCount === 1 ? "personagem sem cena vinculada" : "personagens sem cena vinculada"} — mostrar apenas ${semCenaCount === 1 ? "este" : "estes"}`}
          </Link>
        </NextStepFooter>
      )}
    </div>
  );
}
