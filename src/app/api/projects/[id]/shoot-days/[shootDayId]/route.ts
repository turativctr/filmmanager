import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { shootDaySchema } from "@/lib/validation/shoot-day";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; shootDayId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: params.shootDayId, projectId: params.id },
  });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = shootDaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, ...rest } = parsed.data;

  if (rest.numeroDia !== shootDay.numeroDia) {
    const duplicate = await prisma.shootDay.findFirst({
      where: { projectId: params.id, numeroDia: rest.numeroDia, NOT: { id: shootDay.id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Já existe uma diária com esse número." }, { status: 409 });
    }
  }

  const updated = await prisma.shootDay.update({
    where: { id: shootDay.id },
    data: { ...rest, data: new Date(data) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; shootDayId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: params.shootDayId, projectId: params.id },
  });
  if (!shootDay) return NextResponse.json({ error: "Diária não encontrada." }, { status: 404 });

  await prisma.shootDay.delete({ where: { id: shootDay.id } });

  return NextResponse.json({ ok: true });
}
