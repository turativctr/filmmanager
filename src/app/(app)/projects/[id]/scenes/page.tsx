import { FdxImportDialog } from "@/components/scenes/fdx-import-dialog";
import { ScenesTable } from "@/components/scenes/scenes-table";
import { SceneFormDialog } from "@/components/scenes/scene-form-dialog";
import { InfoBanner } from "@/components/shared/info-banner";
import { Card, CardContent } from "@/components/ui/card";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

export default async function ScenesPage({ params }: { params: { id: string } }) {
  const [project, scenes, characters] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.id }, select: { sistemaIdElenco: true } }),
    prisma.scene.findMany({
      where: { projectId: params.id },
      include: { cast: { select: { characterId: true } } },
    }),
    prisma.character.findMany({
      where: { projectId: params.id },
      orderBy: { idCurto: "asc" },
      select: { id: true, idCurto: true, numeroElenco: true, personagem: true },
    }),
  ]);

  const sortedScenes = [...scenes]
    .sort((a, b) => naturalCompare(a.numero, b.numero))
    .map((scene) => ({ ...scene, paginas: scene.paginas.toString() }));

  return (
    <div className="space-y-4">
      <InfoBanner
        storageKey="scenes"
        title="Cenas"
        description="As cenas são a base de todo o projeto. Cada cena contém as informações que alimentam o Breakdown, o Stripboard e os documentos gerados. Importe do roteiro (.fdx) ou cadastre manualmente."
      />

      <div className="flex justify-end gap-2">
        <FdxImportDialog projectId={params.id} />
        <SceneFormDialog projectId={params.id} characters={characters} sistemaIdElenco={project.sistemaIdElenco} />
      </div>

      {sortedScenes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma cena cadastrada ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScenesTable
              projectId={params.id}
              scenes={sortedScenes}
              characters={characters}
              sistemaIdElenco={project.sistemaIdElenco}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
