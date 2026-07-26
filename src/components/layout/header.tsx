"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const moduleName = !params?.id ? null : pathname?.includes("/budget/") ? "Budgeting" : "Scheduling";
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
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projetos
        </Link>
        {activeProjectTitle && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{activeProjectTitle}</span>
          </>
        )}
        {moduleName && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span
              className={
                moduleName === "Budgeting"
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                  : "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800"
              }
            >
              {moduleName}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
