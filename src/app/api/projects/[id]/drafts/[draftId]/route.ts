import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getScriptDraftDetail } from "@/lib/draft-report-data";
import { findOwnedProject } from "@/lib/project-access";

export async function GET(request: Request, { params }: { params: { id: string; draftId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const detail = await getScriptDraftDetail(params.id, params.draftId);
  if (!detail) return NextResponse.json({ error: "Draft não encontrado." }, { status: 404 });

  return NextResponse.json(detail);
}
