import { MapPin } from "lucide-react";

import { LocacoesTable } from "@/components/locacoes/locacoes-table";
import { NewLocacaoDialog } from "@/components/locacoes/new-locacao-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getLocacoesListData } from "@/lib/locacao-data";

export default async function LocacoesPage({ params }: { params: { id: string } }) {
  const { locacoes, semLocacaoCount } = await getLocacoesListData(params.id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Locações"
        help={{
          title: "Locações",
          description:
            "O set é o lugar da ficção (vem do roteiro). A locação é o lugar real onde se filma — decisão de produção, com endereço e informação de apoio. Uma locação pode abrigar vários sets do roteiro.",
        }}
      />

      {locacoes.length === 0 && semLocacaoCount === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nenhuma locação cadastrada ainda"
          description="Locações são criadas automaticamente ao importar o roteiro (uma por set), ou você pode cadastrar manualmente aqui."
          actions={<NewLocacaoDialog projectId={params.id} />}
        />
      ) : (
        <LocacoesTable projectId={params.id} locacoes={locacoes} semLocacaoCount={semLocacaoCount} />
      )}
    </div>
  );
}
