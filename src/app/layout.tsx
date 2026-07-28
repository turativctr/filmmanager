import type { Tema } from "@prisma/client";
import { getServerSession } from "next-auth";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";

import { AuthSessionProvider } from "@/components/session-provider";
import { ThemeCookieSync } from "@/components/theme/theme-cookie-sync";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidTema, THEME_COOKIE_NAME } from "@/lib/theme";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Film Manager",
  description: "Gestão de produção audiovisual — Scheduling e Budgeting",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve o tema ANTES de renderizar o <html> pra não piscar no tema errado (ver PARTE 3 do
  // sistema de temas): o cookie é a via rápida (sem round-trip no banco); só quando ele ainda não
  // existe (primeira visita, ou cookies limpos) é que consulta o banco — e nesse caso
  // <ThemeCookieSync> grava o cookie no cliente pra as próximas navegações não precisarem mais
  // disso. Modo de Set ignora tudo isso de propósito (ver (set-mode)/layout.tsx).
  const cookieTema = cookies().get(THEME_COOKIE_NAME)?.value;
  let tema: Tema;
  let hadCookie: boolean;

  if (cookieTema && isValidTema(cookieTema)) {
    tema = cookieTema;
    hadCookie = true;
  } else {
    hadCookie = false;
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { tema: true } });
      tema = user?.tema ?? "DOCUMENTARIO";
    } else {
      tema = "DOCUMENTARIO";
    }
  }

  return (
    <html lang="pt-BR" data-theme={tema.toLowerCase()}>
      <body className={inter.className}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
        {!hadCookie && <ThemeCookieSync tema={tema} />}
      </body>
    </html>
  );
}
