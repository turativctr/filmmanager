import { renderToBuffer } from "@react-pdf/renderer";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getCastAccountingData } from "@/lib/ad-documents-data";
import { gerarNomeArquivo } from "@/lib/filename";
import { CastAccountingDocument, type CastAccountingDocRow } from "@/lib/pdf/cast-accounting-document";
import { findOwnedProject } from "@/lib/project-access";

const holdDaysSchema = z.object({
  diasHold: z.array(z.object({ characterId: z.string(), diasHold: z.coerce.number().int().nonnegative() })).default([]),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = holdDaysSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const holdByCharacterId = new Map(parsed.data.diasHold.map((d) => [d.characterId, d.diasHold]));
  const data = await getCastAccountingData(params.id);

  const rows: CastAccountingDocRow[] = data.rows.map((row) => ({
    idCurto: row.idCurto,
    numeroElenco: row.numeroElenco,
    categoria: row.categoria,
    personagem: row.personagem,
    ator: row.ator,
    cacheeDiario: row.cacheeDiario,
    percentualHold: row.percentualHold,
    diasTrabalhados: row.diasTrabalhados,
    diasHold: holdByCharacterId.get(row.characterId) ?? 0,
  }));

  const buffer = await renderToBuffer(
    <CastAccountingDocument
      data={{
        titulo: data.titulo,
        diretor: data.diretor,
        producao: data.producao,
        sistemaIdElenco: data.sistemaIdElenco,
        rows,
      }}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${gerarNomeArquivo({ projeto: project, tipo: "PrestacaoContas", ext: "pdf" })}"`,
    },
  });
}
