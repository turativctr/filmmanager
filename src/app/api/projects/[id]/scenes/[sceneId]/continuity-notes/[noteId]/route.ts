import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";
import { continuityNoteSchema } from "@/lib/validation/continuity-note";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; sceneId: string; noteId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const note = await prisma.continuityNote.findFirst({
    where: { id: params.noteId, sceneId: params.sceneId, scene: { projectId: params.id } },
  });
  if (!note) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });

  const body = await request.json();
  const parsed = continuityNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.continuityNote.update({
    where: { id: note.id },
    data: parsed.data,
    include: { shootDay: { select: { numeroDia: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; sceneId: string; noteId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const note = await prisma.continuityNote.findFirst({
    where: { id: params.noteId, sceneId: params.sceneId, scene: { projectId: params.id } },
  });
  if (!note) return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });

  await prisma.continuityNote.delete({ where: { id: note.id } });

  return NextResponse.json({ ok: true });
}
