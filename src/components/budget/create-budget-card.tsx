"use client";

import { Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export function CreateBudgetCard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/budget`, { method: "POST" });

    setLoading(false);

    if (!res.ok) {
      setError("Não foi possível criar o orçamento.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-2">
      <EmptyState
        icon={Wallet}
        title="Nenhum orçamento ainda"
        description="Comece adicionando itens de custo por departamento, ou use o template pré-configurado de curta-metragem pra começar rápido — ele já vem com os grupos de contas prontos."
        actions={
          <>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Criando..." : "Usar template"}
            </Button>
            <Button variant="outline" onClick={handleCreate} disabled={loading}>
              {loading ? "Criando..." : "Adicionar item"}
            </Button>
          </>
        }
      />
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
