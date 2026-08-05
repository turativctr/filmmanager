"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { GLASS_HOVER_BG } from "@/lib/glass";
import type { ModuleKey } from "@/lib/module-theme";
import { cn } from "@/lib/utils";

import { NavLink } from "./nav-link";

const STORAGE_PREFIX = "film-manager:sidebar-group-open:";

/** Grupo colapsável da sidebar (Cadastro/Preparação/Orçamento) — expande só por clique (nunca
 *  hover, o app roda em iPad e hover não existe no toque). O grupo que contém a página atual abre
 *  sozinho, sempre, independente do que está salvo; os outros lembram a última preferência do
 *  usuário em localStorage, mesmo padrão de `src/components/shared/info-banner.tsx` (default
 *  fechado, corrige em useEffect — aceita o mesmo flash de 1-tick já presente lá). Clicar no
 *  cabeçalho grava a preferência mesmo quando o grupo está forçado aberto por ser o atual. */
export function SidebarGroup({
  storageKey,
  label,
  module,
  items,
  projectId,
  pathname,
}: {
  storageKey: string;
  label: string;
  module: ModuleKey;
  items: { segment: string; label: string }[];
  projectId: string;
  pathname: string | null;
}) {
  const hrefs = items.map((item) => `/projects/${projectId}/${item.segment}`);
  const isCurrentGroup = hrefs.includes(pathname ?? "");

  const [storedOpen, setStoredOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (stored === "1") setStoredOpen(true);
  }, [storageKey]);

  const open = isCurrentGroup || storedOpen;

  function toggle() {
    const next = !open;
    setStoredOpen(next);
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, next ? "1" : "0");
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex min-h-[44px] w-full items-center justify-between rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          GLASS_HOVER_BG
        )}
      >
        <span>{label}</span>
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-2">
          {items.map((item, index) => (
            <NavLink
              key={item.segment}
              href={hrefs[index]}
              label={item.label}
              active={pathname === hrefs[index]}
              module={module}
            />
          ))}
        </div>
      )}
    </div>
  );
}
