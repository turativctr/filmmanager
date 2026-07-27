import { Users } from "lucide-react";

import { ExtraFormDialog } from "@/components/extras/extra-form-dialog";
import { ExtrasTable } from "@/components/extras/extras-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

export default async function ExtrasPage({ params }: { params: { id: string } }) {
  const [extras, scenes] = await Promise.all([
    prisma.extra.findMany({
      where: { projectId: params.id },
      include: { cenas: { include: { scene: { select: { numero: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.scene.findMany({
      where: { projectId: params.id },
      select: { id: true, numero: true },
    }),
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
          title="Nenhuma figuração cadastrada ainda"
          description="Cadastre a figuração presente nas cenas para acompanhar chamada e prestação de contas."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ExtrasTable projectId={params.id} extras={serializedExtras} scenes={sortedScenes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
