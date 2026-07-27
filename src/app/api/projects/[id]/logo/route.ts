import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedProject } from "@/lib/project-access";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Formato não suportado — use PNG, JPG ou WEBP." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máximo 2MB)." }, { status: 400 });
  }

  // Guardado como data URI direto na coluna (Postgres TEXT não tem limite prático pro tamanho
  // aqui, já limitado a 2MB acima) em vez de escrito em disco — o filesystem da Vercel é
  // read-only em runtime, então gravar em public/ funcionava só em dev local.
  const buffer = Buffer.from(await file.arrayBuffer());
  const logoUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  await prisma.project.update({ where: { id: params.id }, data: { logoUrl } });

  return NextResponse.json({ logoUrl });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const project = await findOwnedProject(params.id, session.user.id, session.user.role);
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

  await prisma.project.update({ where: { id: params.id }, data: { logoUrl: null } });

  return NextResponse.json({ ok: true });
}
