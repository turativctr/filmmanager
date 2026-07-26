import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getBudgetData } from "@/lib/budget-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { BudgetComparisonDocument } from "@/lib/pdf/budget-comparison-document";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const budget = await getBudgetData(params.id);
  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  if (budget.scenarios.length < 2) {
    return NextResponse.json(
      { error: "É preciso ao menos 2 cenários para gerar a comparação." },
      { status: 400 }
    );
  }

  const buffer = await renderToBuffer(
    <BudgetComparisonDocument budget={budget} projectTitulo={project.titulo} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "ComparacaoCenarios", ext: "pdf" })}"`,
    },
  });
}
