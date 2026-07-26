"use client";

import { CalendarRange, FileOutput, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STEPS = [
  {
    icon: FileText,
    title: "Importe o roteiro",
    description: "Faça upload do .fdx para detectar cenas e personagens automaticamente",
  },
  {
    icon: CalendarRange,
    title: "Monte o cronograma",
    description: "Organize as cenas em dias de filmagem no Stripboard com drag-and-drop",
  },
  {
    icon: FileOutput,
    title: "Gere os documentos",
    description: "Call Sheet, Plano HH, Análise Técnica e todos os documentos do AD em PDF",
  },
];

export function WelcomeTourModal({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  async function finish(destination: string | null) {
    setLoading(true);
    await fetch("/api/user/tour", { method: "PATCH" }).catch(() => {});
    setLoading(false);
    setOpen(false);
    if (destination) {
      router.push(destination);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && finish(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bem-vindo ao Film Manager</DialogTitle>
          <DialogDescription>Veja como funciona o fluxo básico:</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.title}>
                <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          <Button onClick={() => finish(`/projects/${projectId}/scenes`)} disabled={loading} className="w-full">
            Começar
          </Button>
          <button
            type="button"
            onClick={() => finish(null)}
            disabled={loading}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Pular introdução
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
