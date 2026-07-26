import { CastTable } from "@/components/cast/cast-table";
import { CharacterFormDialog } from "@/components/cast/character-form-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { naturalCompare } from "@/lib/natural-sort";
import { prisma } from "@/lib/prisma";

export default async function CastPage({ params }: { params: { id: string } }) {
  const [characters, scenes] = await Promise.all([
    prisma.character.findMany({
      where: { projectId: params.id },
      include: { scenes: { include: { scene: { select: { numero: true } } } } },
    }),
    prisma.scene.findMany({
      where: { projectId: params.id },
      select: { id: true, numero: true },
    }),
  ]);

  const sortedCharacters = [...characters].sort(
    (a, b) => (a.numeroElenco ?? Infinity) - (b.numeroElenco ?? Infinity) || naturalCompare(a.idCurto, b.idCurto)
  );
  const sortedScenes = [...scenes].sort((a, b) => naturalCompare(a.numero, b.numero));

  return (
    <div className="space-y-4">
      <PageHeader title="Elenco" actions={<CharacterFormDialog projectId={params.id} scenes={sortedScenes} />} />

      {sortedCharacters.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhum personagem cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <CastTable projectId={params.id} characters={sortedCharacters} scenes={sortedScenes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
