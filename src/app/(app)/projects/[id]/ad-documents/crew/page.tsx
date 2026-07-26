import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

import { CrewMemberFormDialog } from "@/components/ad-documents/crew-member-form-dialog";
import { CrewTable } from "@/components/ad-documents/crew-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function CrewPage({ params }: { params: { id: string } }) {
  const crew = await prisma.crewMember.findMany({
    where: { projectId: params.id },
    orderBy: [{ departamento: "asc" }, { nome: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href={`/projects/${params.id}/ad-documents`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Documentos do AD
            </Link>
          </Button>
          <h2 className="text-xl font-semibold tracking-tight">Equipe</h2>
          <p className="text-sm text-muted-foreground">
            Contatos usados na Lista de Contatos da Equipe.
          </p>
        </div>
        <CrewMemberFormDialog projectId={params.id} />
      </div>

      {crew.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Users className="h-8 w-8" />
            <p>Nenhum membro de equipe cadastrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <CrewTable projectId={params.id} crew={crew} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
