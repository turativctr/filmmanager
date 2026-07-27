import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

// .strict() rejeita a requisição inteira se vier qualquer campo além destes três (ex.: "role") —
// cadastro aberto NUNCA pode aceitar um papel vindo do corpo da requisição, nem silenciosamente.
const registerSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // role NUNCA vem do corpo da requisição (registerSchema só aceita name/email/password — zod
  // descarta campos extras por padrão) — forçado explicitamente aqui como reforço, pra deixar
  // claro que cadastro aberto nunca pode criar um ADMIN.
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "USER" },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
