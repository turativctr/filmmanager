import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { CastAccountingTable } from "@/components/ad-documents/cast-accounting-table";
import { Button } from "@/components/ui/button";
import { getCastAccountingData } from "@/lib/ad-documents-data";

export default async function CastAccountingPage({ params }: { params: { id: string } }) {
  const data = await getCastAccountingData(params.id);

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href={`/projects/${params.id}/ad-documents`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Documentos do AD
          </Link>
        </Button>
        <h2 className="text-xl font-semibold tracking-tight">Prestação de Contas do Elenco</h2>
        <p className="text-sm text-muted-foreground">
          Dias trabalhados são calculados automaticamente. Cachê/dia e % hold ficam salvos no
          personagem; dias de hold são preenchidos na hora de gerar o PDF.
        </p>
      </div>

      <CastAccountingTable
        projectId={params.id}
        initialRows={data.rows}
        sistemaIdElenco={data.sistemaIdElenco}
        projeto={{ titulo: data.titulo, sigla: data.sigla }}
      />
    </div>
  );
}
