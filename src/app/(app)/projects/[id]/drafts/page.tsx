import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { ImportDraftDialog } from "@/components/drafts/import-draft-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

const COR_CLASSES: Record<string, string> = {
  Branco: "bg-gray-100 text-gray-700 border-gray-300",
  Azul: "bg-blue-100 text-blue-800 border-blue-300",
  Rosa: "bg-pink-100 text-pink-800 border-pink-300",
  Amarelo: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Verde: "bg-green-100 text-green-800 border-green-300",
  Goldenrod: "bg-amber-100 text-amber-800 border-amber-300",
  Buff: "bg-orange-50 text-orange-800 border-orange-200",
  Salmão: "bg-rose-100 text-rose-800 border-rose-300",
  Cereja: "bg-red-100 text-red-800 border-red-300",
};

function corClasses(corRevisao: string): string {
  const baseColor = corRevisao.replace(/^\d+ª\s+/, "");
  return COR_CLASSES[baseColor] ?? "bg-gray-100 text-gray-700 border-gray-300";
}

export default async function DraftsPage({ params }: { params: { id: string } }) {
  const drafts = await prisma.scriptDraft.findMany({
    where: { projectId: params.id },
    orderBy: { numero: "desc" },
    include: {
      _count: { select: { sceneDiffs: true } },
      sceneDiffs: { select: { tipo: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Drafts do roteiro</h2>
          <p className="text-sm text-muted-foreground">
            Histórico de versões importadas, com o que mudou em cada uma.
          </p>
        </div>
        <ImportDraftDialog projectId={params.id} />
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8" />
            <p>Nenhum draft registrado ainda. Importe uma versão do roteiro para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const adicionadas = draft.sceneDiffs.filter((d) => d.tipo === "ADICIONADA").length;
            const removidas = draft.sceneDiffs.filter((d) => d.tipo === "REMOVIDA").length;
            const modificadas = draft.sceneDiffs.filter((d) => d.tipo === "MODIFICADA").length;

            return (
              <Link key={draft.id} href={`/projects/${params.id}/drafts/${draft.id}`}>
                <Card className="transition-colors hover:border-foreground/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-semibold",
                          corClasses(draft.corRevisao)
                        )}
                      >
                        Draft {draft.numero} · {draft.corRevisao}
                      </span>
                      <div className="text-sm text-muted-foreground">
                        {draft.numeroDraft && <span>{draft.numeroDraft}</span>}
                        {draft.dataDraft && <span> · {draft.dataDraft}</span>}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {draft._count.sceneDiffs === 0
                        ? "Versão original"
                        : `${adicionadas} nova(s) · ${removidas} omitida(s) · ${modificadas} modificada(s)`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
