"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getActiveModule, MODULE_BADGE_CLASS, MODULE_LABEL } from "@/lib/module-theme";

export function Header() {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const activeModule = getActiveModule(pathname);
  const [activeProjectTitle, setActiveProjectTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) {
      setActiveProjectTitle(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/projects/${params.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setActiveProjectTitle(data?.titulo ?? null);
      })
      .catch(() => {
        if (!cancelled) setActiveProjectTitle(null);
      });

    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  return (
    <header className="flex h-14 items-center justify-between rounded-b-2xl border-b border-white/50 bg-white/70 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
          Projetos
        </Link>
        {activeProjectTitle && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-base font-semibold text-foreground">{activeProjectTitle}</span>
          </>
        )}
        {activeModule && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${MODULE_BADGE_CLASS[activeModule]}`}
          >
            {MODULE_LABEL[activeModule]}
          </span>
        )}
      </div>
    </header>
  );
}
