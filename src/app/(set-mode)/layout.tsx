import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";

import { authOptions } from "@/lib/auth";

// Route group irmão de (app) — sem <Sidebar />/<Header />, propositalmente, pra dar ao Modo de
// Set uma experiência full-screen de verdade. Segue o mesmo padrão de auth-check de
// src/app/(app)/layout.tsx (grupos de rota não compartilham layout, então precisa duplicar aqui).
export default async function SetModeLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/projects");

  return (
    // EXCEÇÃO DE PROPÓSITO — Modo de Set ignora o tema do usuário. Ele já tem regra própria
    // (sólido, alto contraste, tipografia maior) por motivo funcional: leitura sob sol, no set.
    // `data-theme="claro"` aqui PRENDE as variáveis CSS de tema (ver globals.css) no valor claro,
    // independente do que o <html> (sistema de temas, ver src/app/layout.tsx) diga — porque
    // variável CSS em cascata é herdada do ancestral mais próximo que a redefine, e este div é
    // mais próximo que o <html>. `bg-background text-foreground` é OBRIGATÓRIO aqui (não só o
    // data-theme): sem um fundo opaco explícito neste nível, o <body> (que fica FORA deste div,
    // colado no <html> — esse sim já no tema do usuário) aparece por trás em qualquer área
    // transparente. NÃO REMOVER nem "corrigir" pra seguir o tema do usuário.
    <div data-theme="claro" className="h-screen w-screen overflow-hidden bg-background text-foreground">
      {children}
      <Toaster richColors position="top-right" />
    </div>
  );
}
