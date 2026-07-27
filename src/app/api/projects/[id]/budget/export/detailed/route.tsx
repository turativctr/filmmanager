import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getBudgetData } from "@/lib/budget-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { BudgetDetailedDocument } from "@/lib/pdf/budget-detailed-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await getBudgetData(params.id);
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const buffer = await renderToBuffer(
    <BudgetDetailedDocument
      budget={budget}
      project={{ titulo: project.titulo, diretor: project.diretor, producao: project.producao }}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "OrcamentoDetalhado", variante: `v${budget.versao}`, ext: "pdf" })}"`,
    },
  });
}
