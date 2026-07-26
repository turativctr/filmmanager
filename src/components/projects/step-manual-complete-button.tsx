"use client";

import type { ProjectStepEtapa } from "@prisma/client";
import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function StepManualCompleteButton({
  projectId,
  etapa,
  isManual,
}: {
  projectId: string;
  etapa: ProjectStepEtapa;
  isManual: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/steps/${etapa}/complete`, {
        method: isManual ? "DELETE" : "POST",
      });
      if (!res.ok) {
        toast.error("Erro ao salvar — tente novamente");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Erro ao salvar — tente novamente");
    } finally {
      setLoading(false);
    }
  }

  if (isManual) {
    return (
      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={toggle} disabled={loading}>
        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
        {loading ? "Desfazendo..." : "Desfazer"}
      </Button>
    );
  }

  return (
    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={toggle} disabled={loading}>
      {loading ? "Salvando..." : "Marcar como concluída"}
    </Button>
  );
}
