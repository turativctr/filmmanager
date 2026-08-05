import { Users } from "lucide-react";
import Link from "next/link";

import { ExtraFormDialog } from "@/components/extras/extra-form-dialog";
import { ExtrasTable } from "@/components/extras/extras-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NextStepFooter } from "@/components/shared/next-step-footer";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

export default async function ExtrasPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semCena?: string };
}) {
  const semCenaAtivo = searchParams.semCena === "1";

  const [extras, scenes, semCenaCount] = await Promise.all([
    prisma.extra.findMany({
      where: { projectId: params.id, ...(semCenaAtivo ? { cenas: { none: {} } } : {}) },
      include: { cenas: { include: { scene: { select: { numero: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.scene.findMany({
      where: { projectId: params.id },
      select: { id: true, numero: true },
    }),
    prisma.extra.count({ where: { projectId: params.id, cenas: { none: {} } } }),
  ]);

  const sortedScenes = [...scenes].sort((a, b) => naturalCompare(a.numero, b.numero));
  const serializedExtras = extras.map((extra) => ({
    ...extra,
    chamada: extra.chamada?.toISOString() ?? null,
    saida: extra.saida?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Figuração" actions={<ExtraFormDialog projectId={params.id} scenes={sortedScenes} />} />

      {extras.length === 0 ? (
        <EmptyState
          icon={Users}
          title={semCenaAtivo ? "Nenhuma figuração sem cena vinculada" : "Nenhuma figuração cadastrada ainda"}
          description={
            semCenaAtivo
              ? "Toda a figuração já tem cena vinculada."
              : "Cadastre a figuração presente nas cenas para acompanhar chamada e prestação de contas."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ExtrasTable projectId={params.id} extras={serializedExtras} scenes={sortedScenes} />
          </CardContent>
        </Card>
      )}

      {semCenaCount > 0 && (
        <NextStepFooter>
          <Link
            href={`/projects/${params.id}/extras${semCenaAtivo ? "" : "?semCena=1"}`}
            className="hover:text-foreground hover:underline"
          >
            {semCenaAtivo
              ? "Mostrar toda a figuração"
              : `${semCenaCount} ${semCenaCount === 1 ? "figuração sem cena vinculada" : "figurações sem cena vinculada"} — mostrar apenas ${semCenaCount === 1 ? "esta" : "estas"}`}
          </Link>
        </NextStepFooter>
      )}
    </div>
  );
}
