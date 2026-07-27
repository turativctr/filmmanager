import { notFound } from "next/navigation";

import { LocacaoApoioSection } from "@/components/locacoes/locacao-apoio-section";
import { LocacaoCenasSection } from "@/components/locacoes/locacao-cenas-section";
import { LocacaoDadosSection } from "@/components/locacoes/locacao-dados-section";
import { PageHeader } from "@/components/shared/page-header";
import { getLocacaoDetailData } from "@/lib/locacao-data";
import { prisma } from "@/lib/prisma";

export default async function LocacaoDetailPage({
  params,
}: {
  params: { id: string; locacaoId: string };
}) {
  const [locacao, otherLocacoes] = await Promise.all([
    getLocacaoDetailData(params.id, params.locacaoId),
    prisma.locacao.findMany({
      where: { projectId: params.id, id: { not: params.locacaoId } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  if (!locacao) notFound();

  return (
    <div className="space-y-4">
      <PageHeader title={locacao.nome} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LocacaoDadosSection projectId={params.id} locacao={locacao} />
        <LocacaoApoioSection
          projectId={params.id}
          locacaoId={locacao.id}
          nome={locacao.nome}
          hospitalNome={locacao.hospitalNome}
          hospitalEndereco={locacao.hospitalEndereco}
          hospitalTelefone={locacao.hospitalTelefone}
          pontosApoio={locacao.pontosApoio}
        />
      </div>

      <LocacaoCenasSection
        projectId={params.id}
        locacaoId={locacao.id}
        scenes={locacao.scenes}
        otherLocacoes={otherLocacoes}
      />
    </div>
  );
}
