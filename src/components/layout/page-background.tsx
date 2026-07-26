"use client";

import { usePathname } from "next/navigation";

import { getActiveModule, MODULE_ACCENT_HEX } from "@/lib/module-theme";

/** Gradiente neutro + 2 orbs decorativos na cor do módulo ativo (opacidade máx. 0.12) — nunca
 *  colore o fundo da página inteira, só esses dois círculos borrados fora do fluxo. Ausente do
 *  layout (set-mode) de propósito — ver a exceção obrigatória do Modo de Set. */
export function PageBackground() {
  const pathname = usePathname();
  const activeModule = getActiveModule(pathname);
  const accent = activeModule ? MODULE_ACCENT_HEX[activeModule] : "#71717A";

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-gradient-to-br from-white via-white to-zinc-50">
      <div
        className="absolute -left-40 -top-40 h-96 w-96 rounded-full blur-3xl"
        style={{ backgroundColor: accent, opacity: 0.12 }}
      />
      <div
        className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full blur-3xl"
        style={{ backgroundColor: accent, opacity: 0.12 }}
      />
    </div>
  );
}
