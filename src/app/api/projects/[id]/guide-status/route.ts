import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { findOwnedProject } from "@/lib/project-access";
import { computeProjectSteps } from "@/lib/project-step";

// Só o que a sidebar precisa pro badge de "Guia de preenchimento" — não a lista completa de
// passos, pra manter o fetch client-side leve.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const steps = await computeProjectSteps(params.id);
  const pendingCount = steps.filter((s) => s.status !== "completo").length;

  return NextResponse.json({ pendingCount });
}
