import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { crewMemberSchema } from "@/lib/validation/crew-member";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const crew = await prisma.crewMember.findMany({
    where: { projectId: params.id },
    orderBy: [{ departamento: "asc" }, { nome: "asc" }],
  });

  return NextResponse.json(crew);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = crewMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, ...data } = parsed.data;

  const crewMember = await prisma.crewMember.create({
    data: { ...data, email: email || null, projectId: params.id },
  });

  return NextResponse.json(crewMember, { status: 201 });
}
