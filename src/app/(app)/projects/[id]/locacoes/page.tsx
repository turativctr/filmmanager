import { MapPin } from "lucide-react";
import Link from "next/link";

import { LocacoesTable } from "@/components/locacoes/locacoes-table";
import { NewLocacaoDialog } from "@/components/locacoes/new-locacao-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { NextStepFooter } from "@/components/shared/next-step-footer";
import { PageHeader } from "@/components/shared/page-header";
import { getLocacoesListData } from "@/lib/locacao-data";

export default async function LocacoesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { semEndereco?: string };
}) {
  const semEnderecoAtivo = searchParams.semEndereco === "1";
  const { locacoes, semLocacaoCount, semEnderecoCount } = await getLocacoesListData(params.id, {
    semEndereco: semEnderecoAtivo,
  });

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

      {locacoes.length === 0 && semLocacaoCount === 0 && !semEnderecoAtivo ? (
        <EmptyState
          icon={MapPin}
          title="Nenhuma locação cadastrada ainda"
          description="Locações são criadas automaticamente ao importar o roteiro (uma por set), ou você pode cadastrar manualmente aqui."
          actions={<NewLocacaoDialog projectId={params.id} />}
        />
      ) : locacoes.length === 0 && semEnderecoAtivo ? (
        <EmptyState icon={MapPin} title="Nenhuma locação sem endereço" description="Todas as locações já têm endereço preenchido." />
      ) : (
        <LocacoesTable projectId={params.id} locacoes={locacoes} semLocacaoCount={semLocacaoCount} />
      )}

      {semEnderecoCount > 0 && (
        <NextStepFooter>
          <Link
            href={`/projects/${params.id}/locacoes${semEnderecoAtivo ? "" : "?semEndereco=1"}`}
            className="hover:text-foreground hover:underline"
          >
            {semEnderecoAtivo
              ? "Mostrar todas as locações"
              : `${semEnderecoCount} ${semEnderecoCount === 1 ? "locação sem endereço" : "locações sem endereço"} — preencher`}
          </Link>
        </NextStepFooter>
      )}
    </div>
  );
}
