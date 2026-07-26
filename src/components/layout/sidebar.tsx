"use client";

import { Clapperboard, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { UserMenu } from "./user-menu";

const SCHEDULING_ITEMS = [
  { segment: "", label: "Visão Geral" },
  { segment: "scenes", label: "Cenas" },
  { segment: "cast", label: "Elenco" },
  { segment: "extras", label: "Figuração" },
  { segment: "stripboard", label: "Stripboard" },
  { segment: "calendar", label: "Calendário" },
  { segment: "dood", label: "DOOD" },
  { segment: "drafts", label: "Drafts" },
  { segment: "ad-documents", label: "Documentos do AD" },
  { segment: "reports", label: "Reports" },
];

const BUDGETING_ITEMS = [
  { segment: "budget/topsheet", label: "Topsheet" },
  { segment: "budget/detalhado", label: "Detalhado" },
  { segment: "budget/globals-fringes", label: "Globals e Fringes" },
  { segment: "budget/cenarios", label: "Cenários" },
  { segment: "budget/acompanhamento", label: "Acompanhamento" },
];

function SectionLabel({ icon: Icon, children }: { icon: typeof Clapperboard; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const projectId = params?.id;

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/projects" className="text-sm font-semibold tracking-tight">
          Film Manager
        </Link>
      </div>
      <nav className="flex flex-1 flex-col overflow-y-auto p-3 pt-0">
        {projectId ? (
          <>
            <SectionLabel icon={Clapperboard}>Scheduling</SectionLabel>
            <div className="flex flex-col gap-1">
              {SCHEDULING_ITEMS.map(({ segment, label }) => {
                const href = segment ? `/projects/${projectId}/${segment}` : `/projects/${projectId}`;
                return <NavLink key={segment} href={href} label={label} active={pathname === href} />;
              })}
            </div>

            <div className="my-3 border-t" />

            <SectionLabel icon={Wallet}>Budgeting</SectionLabel>
            <div className="flex flex-col gap-1">
              {BUDGETING_ITEMS.map(({ segment, label }) => {
                const href = `/projects/${projectId}/${segment}`;
                return <NavLink key={segment} href={href} label={label} active={pathname === href} />;
              })}
            </div>
          </>
        ) : (
          <Link
            href="/projects"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Clapperboard className="h-4 w-4" />
            Projetos
          </Link>
        )}
      </nav>
      <UserMenu />
    </aside>
  );
}
