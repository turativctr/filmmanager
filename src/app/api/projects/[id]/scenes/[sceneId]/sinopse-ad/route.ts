import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { sceneSinopseADSchema } from "@/lib/validation/scene";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const scene = await prisma.scene.findFirst({
    where: { id: params.sceneId, projectId: params.id },
  });
  if (!scene) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = sceneSinopseADSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.scene.update({
    where: { id: scene.id },
    data: { sinopseAD: parsed.data.sinopseAD },
  });

  return NextResponse.json(updated);
}
