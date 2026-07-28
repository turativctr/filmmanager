"use client";

import { Clapperboard, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { GLASS_BG, GLASS_BORDER_COLOR, GLASS_HOVER_BG } from "@/lib/glass";
import { MODULE_ACTIVE_ITEM_CLASS, type ModuleKey } from "@/lib/module-theme";
import { cn } from "@/lib/utils";

import { UserMenu } from "./user-menu";

// Drafts mora na seção Scheduling visualmente, mas é seu próprio módulo de cor ("criação e
// escrita", roxo) — por isso cada item carrega seu módulo individualmente em vez de a seção
// inteira ditar uma cor só. Elenco/Figuração não foram citados na especificação de cores; ficam
// no módulo scheduling por padrão, junto do resto da seção.
const SCHEDULING_ITEMS: { segment: string; label: string; module: ModuleKey }[] = [
  { segment: "", label: "Visão Geral", module: "scheduling" },
  { segment: "scenes", label: "Cenas", module: "scheduling" },
  { segment: "cast", label: "Elenco", module: "scheduling" },
  { segment: "extras", label: "Figuração", module: "scheduling" },
  { segment: "locacoes", label: "Locações", module: "scheduling" },
  { segment: "stripboard", label: "Stripboard", module: "scheduling" },
  { segment: "calendar", label: "Calendário", module: "scheduling" },
  { segment: "dood", label: "DOOD", module: "scheduling" },
  { segment: "drafts", label: "Versões do roteiro", module: "drafts" },
  { segment: "documentos", label: "Documentos", module: "scheduling" },
];

const BUDGETING_ITEMS: { segment: string; label: string; module: ModuleKey }[] = [
  { segment: "budget/topsheet", label: "Resumo", module: "budgeting" },
  { segment: "budget/detalhado", label: "Detalhado", module: "budgeting" },
  { segment: "budget/globals-fringes", label: "Globais e Encargos", module: "budgeting" },
  { segment: "budget/cenarios", label: "Cenários", module: "budgeting" },
  { segment: "budget/acompanhamento", label: "Acompanhamento", module: "budgeting" },
];

function SectionLabel({ icon: Icon, children }: { icon: typeof Clapperboard; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function NavLink({
  href,
  label,
  active,
  module,
}: {
  href: string;
  label: string;
  active: boolean;
  module: ModuleKey;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md border-l-[3px] border-l-transparent px-3 py-2 text-sm font-medium transition-colors",
        active
          ? MODULE_ACTIVE_ITEM_CLASS[module]
          : cn("text-muted-foreground hover:text-foreground", GLASS_HOVER_BG)
      )}
    >
      {label}
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
        "hidden w-56 shrink-0 rounded-r-2xl border-r md:flex md:flex-col",
        GLASS_BG,
        GLASS_BORDER_COLOR
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-4", GLASS_BORDER_COLOR)}>
        <Link href="/projects" className="text-sm font-semibold tracking-tight">
          Film Manager
        </Link>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto p-3 pt-0">
        {projectId ? (
          <>
            <SectionLabel icon={Clapperboard}>Planejamento</SectionLabel>
            <div className="flex flex-col gap-1">
              {SCHEDULING_ITEMS.map(({ segment, label, module }) => {
                const href = segment ? `/projects/${projectId}/${segment}` : `/projects/${projectId}`;
                return (
                  <NavLink key={segment} href={href} label={label} active={pathname === href} module={module} />
                );
              })}
            </div>

            <div className={cn("my-3 border-t", GLASS_BORDER_COLOR)} />

            <SectionLabel icon={Wallet}>Orçamento</SectionLabel>
            <div className="flex flex-col gap-1">
              {BUDGETING_ITEMS.map(({ segment, label, module }) => {
                const href = `/projects/${projectId}/${segment}`;
                return (
                  <NavLink key={segment} href={href} label={label} active={pathname === href} module={module} />
                );
              })}
            </div>
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
