import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";

import { authOptions } from "@/lib/auth";

// Route group irmão de (app) — sem <Sidebar />/<Header />, propositalmente, pra dar ao Modo de
// Set uma experiência full-screen de verdade. Segue o mesmo padrão de auth-check de
// src/app/(app)/layout.tsx (grupos de rota não compartilham layout, então precisa duplicar aqui).
export default async function SetModeLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/api/auth/auto-login?callbackUrl=/projects");

  return (
    <div className="h-screen w-screen overflow-hidden">
      {children}
      <Toaster richColors position="top-right" />
    </div>
  );
}
