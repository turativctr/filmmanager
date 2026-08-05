"use client";

import { Clapperboard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  GLASS_CHROME_BG,
  GLASS_CHROME_BORDER_COLOR,
  GLASS_CHROME_BORDER_WIDTH_B,
  GLASS_CHROME_BORDER_WIDTH_R,
  GLASS_CHROME_BORDER_WIDTH_T,
  GLASS_HOVER_BG,
} from "@/lib/glass";
import type { ModuleKey } from "@/lib/module-theme";
import { cn } from "@/lib/utils";

import { NavLink } from "./nav-link";
import { SidebarGroup } from "./sidebar-group";
import { UserMenu } from "./user-menu";

// Itens soltos no topo — não entram em nenhum grupo colapsável. Tratamentos carrega seu próprio
// módulo de cor ("criação e escrita", roxo) mesmo estando fora da seção de Cadastro/Preparação.
const TOP_ITEMS: { segment: string; label: string; module: ModuleKey }[] = [
  { segment: "", label: "Visão Geral", module: "scheduling" },
  { segment: "drafts", label: "Tratamentos", module: "drafts" },
];

const GROUPS: {
  storageKey: string;
  label: string;
  module: ModuleKey;
  items: { segment: string; label: string }[];
}[] = [
  {
    storageKey: "cadastro",
    label: "Cadastro",
    module: "scheduling",
    items: [
      { segment: "scenes", label: "Cenas" },
      { segment: "cast", label: "Elenco" },
      { segment: "extras", label: "Figuração" },
      { segment: "locacoes", label: "Locações" },
    ],
  },
  {
    storageKey: "preparacao",
    label: "Preparação",
    module: "scheduling",
    items: [
      { segment: "stripboard", label: "Stripboard" },
      { segment: "calendar", label: "Calendário" },
      { segment: "dood", label: "DOOD" },
      { segment: "documentos", label: "Documentos" },
    ],
  },
  {
    storageKey: "orcamento",
    label: "Orçamento",
    module: "budgeting",
    items: [
      { segment: "budget/topsheet", label: "Resumo" },
      { segment: "budget/detalhado", label: "Detalhado" },
      { segment: "budget/globals-fringes", label: "Globais e Encargos" },
      { segment: "budget/cenarios", label: "Cenários" },
      { segment: "budget/acompanhamento", label: "Acompanhamento" },
    ],
  },
];

/** "Guia de preenchimento" — item com destaque próprio: âmbar (`alerta`) enquanto há passo
 *  pendente, neutro quando os 6 passos estão completos. Sidebar é client-only e não recebe dados
 *  de servidor, então busca a contagem via fetch (mesmo padrão já usado em `ScenePlanosPanel`). */
function GuiaNavLink({ projectId, active }: { projectId: string; active: boolean }) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/guide-status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pendingCount: number } | null) => {
        if (!cancelled && data) setPendingCount(data.pendingCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const hasPending = (pendingCount ?? 0) > 0;

  return (
    <Link
      href={`/projects/${projectId}/guia`}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border-l-[3px] px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-l-scheduling-accent" : "border-l-transparent",
        hasPending ? "bg-alerta-bg text-alerta-fg" : "bg-neutro-bg text-neutro-fg"
      )}
    >
      <span>Guia de preenchimento</span>
      {hasPending && <span className="text-xs font-semibold">{pendingCount}</span>}
    </Link>
  );
}

export function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const projectId = params?.id;

  return (
    <aside
      className={cn(
        "hidden w-56 shrink-0 rounded-r-2xl md:flex md:flex-col",
        GLASS_CHROME_BORDER_WIDTH_R,
        GLASS_CHROME_BG,
        GLASS_CHROME_BORDER_COLOR
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center px-4",
          GLASS_CHROME_BORDER_WIDTH_B,
          GLASS_CHROME_BORDER_COLOR
        )}
      >
        <Link href="/projects" className="text-sm font-semibold tracking-tight">
          Film Manager
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 pt-2">
        {projectId ? (
          <>
            {TOP_ITEMS.map(({ segment, label, module }) => {
              const href = segment ? `/projects/${projectId}/${segment}` : `/projects/${projectId}`;
              return (
                <NavLink key={segment || "overview"} href={href} label={label} active={pathname === href} module={module} />
              );
            })}
            <GuiaNavLink projectId={projectId} active={pathname === `/projects/${projectId}/guia`} />

            <div className={cn("my-2", GLASS_CHROME_BORDER_WIDTH_T, GLASS_CHROME_BORDER_COLOR)} />

            {GROUPS.map((group) => (
              <SidebarGroup
                key={group.storageKey}
                storageKey={group.storageKey}
                label={group.label}
                module={group.module}
                items={group.items}
                projectId={projectId}
                pathname={pathname}
              />
            ))}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <Link
              href="/projects"
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
                GLASS_HOVER_BG
              )}
            >
              <Clapperboard className="h-4 w-4" />
              Projetos
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === "/admin"
                    ? "bg-neutro-bg text-neutro-fg"
                    : cn("text-muted-foreground hover:text-foreground", GLASS_HOVER_BG)
                )}
              >
                <ShieldCheck className="h-4 w-4" />
                Administração
              </Link>
            )}
          </div>
        )}
      </nav>
      <UserMenu />
    </aside>
  );
}
