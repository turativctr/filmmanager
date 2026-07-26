"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { GlobalData } from "./types";

export function SyncSchedulingBanner({ projectId, globals }: { projectId: string; globals: GlobalData[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const dias = globals.find((g) => g.chave === "G_DIAS_SET")?.valor;
  const semanas = globals.find((g) => g.chave === "G_SEMANAS")?.valor;

  async function handleSync() {
    setLoading(true);
    await fetch(`/api/projects/${projectId}/budget/sync-scheduling`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
      <span>
        {dias != null ? (
          <>
            Sincronizado com Scheduling: <span className="font-medium">{dias} dias de set</span>,{" "}
            <span className="font-medium">{semanas} semana{semanas === 1 ? "" : "s"}</span>
          </>
        ) : (
          "Ainda não sincronizado com Scheduling."
        )}
      </span>
      <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        {loading ? "Sincronizando..." : "Sincronizar com Scheduling"}
      </Button>
    </div>
  );
}
