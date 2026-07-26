import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { shootDaySchema } from "@/lib/validation/shoot-day";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const body = await request.json();
  const parsed = shootDaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, ...rest } = parsed.data;

  const existing = await prisma.shootDay.findFirst({
    where: { projectId: params.id, numeroDia: rest.numeroDia },
  });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma diária com esse número." }, { status: 409 });
  }

  const shootDay = await prisma.shootDay.create({
    data: { ...rest, data: new Date(data), projectId: params.id },
  });

  return NextResponse.json(shootDay, { status: 201 });
}
