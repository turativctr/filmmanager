"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AddLineItemButton({ projectId, accountId }: { projectId: string; accountId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    await fetch(`/api/projects/${projectId}/budget/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        descricao: "Novo item",
        quantidade: 1,
        unidade: "unidade",
        periodo: 1,
        taxa: 0,
        moeda: "BRL",
        taxaCambio: 1,
        isFrengeable: false,
      }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleAdd} disabled={loading} className="h-7 text-xs">
      <Plus className="mr-1 h-3.5 w-3.5" />
      Item
    </Button>
  );
}
