import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { crewMemberSchema } from "@/lib/validation/crew-member";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; crewMemberId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const crewMember = await prisma.crewMember.findFirst({
    where: { id: params.crewMemberId, projectId: params.id },
  });
  if (!crewMember) return NextResponse.json({ error: "Membro de equipe não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = crewMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, ...data } = parsed.data;

  const updated = await prisma.crewMember.update({
    where: { id: crewMember.id },
    data: { ...data, email: email || null },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; crewMemberId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const crewMember = await prisma.crewMember.findFirst({
    where: { id: params.crewMemberId, projectId: params.id },
  });
  if (!crewMember) return NextResponse.json({ error: "Membro de equipe não encontrado." }, { status: 404 });

  await prisma.crewMember.delete({ where: { id: crewMember.id } });

  return NextResponse.json({ ok: true });
}
