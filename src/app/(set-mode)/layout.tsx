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
    // `data-theme="documentario"` aqui PRENDE as variáveis CSS de tema (ver globals.css) no valor
    // documentário (onda 3 renomeou de "claro" — ver PARTE 3 do pedido; a proteção é a mesma, só
    // o valor do atributo mudou), independente do que o <html> (sistema de temas, ver
    // src/app/layout.tsx) diga — porque variável CSS em cascata é herdada do ancestral mais
    // próximo que a redefine, e este div é mais próximo que o <html>. `bg-background
    // text-foreground` é OBRIGATÓRIO aqui (não só o data-theme): sem um fundo opaco explícito
    // neste nível, o <body> (que fica FORA deste div, colado no <html> — esse sim já no tema do
    // usuário) aparece por trás em qualquer área transparente. NÃO REMOVER nem "corrigir" pra
    // seguir o tema do usuário. Testar especificamente com Experimental ativo no <html> — era o
    // tema que mais vazava aqui na onda 2 (o tratamento de superfície dele usava seletores de
    // classe tipo `[data-theme="experimental"] .algo`, que casam com QUALQUER ancestral com o
    // atributo, não só o mais próximo — diferente de variável CSS). A onda 3 removeu esse
    // tratamento por completo (ver globals.css, comentário no bloco do Experimental), então esse
    // vetor específico de vazamento não existe mais — mas continua sendo o teste mais exigente
    // pra confirmar que o pin segue funcionando.
    <div data-theme="documentario" className="h-screen w-screen overflow-hidden bg-background text-foreground">
      {children}
      <Toaster richColors position="top-right" />
    </div>
  );
}
