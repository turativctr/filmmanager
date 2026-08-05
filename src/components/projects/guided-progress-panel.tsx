import type { ProjectStepEtapa } from "@prisma/client";
import { Check, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { StepManualCompleteButton } from "@/components/projects/step-manual-complete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ProgressStepStatus = "completo" | "parcial" | "pendente";

export type ProgressStep = {
  key: string;
  etapa: ProjectStepEtapa;
  icon: LucideIcon;
  title: string;
  description: string;
  status: ProgressStepStatus;
  /** Etapa está "completo" porque foi marcada manualmente (não pelo critério automático). */
  isManual: boolean;
  actionLabel: string;
  href: string;
};

/** Primeira etapa "pendente" — tudo antes dela já desbloqueou a seguinte (completo OU parcial
 *  contam como "passou dessa etapa"); tudo depois dela ainda está bloqueado. Exportada porque o
 *  bloco "Comece por aqui" do Estado A da Visão Geral reaproveita a mesma regra de disponibilidade
 *  num subconjunto dos passos. */
export function currentStepIndex(steps: ProgressStep[]): number {
  const idx = steps.findIndex((s) => s.status === "pendente");
  return idx === -1 ? steps.length : idx;
}

export function GuidedProgressPanel({ projectId, steps }: { projectId: string; steps: ProgressStep[] }) {
  const currentIndex = currentStepIndex(steps);

  return (
    <div className="rounded-lg border bg-card">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCurrent = index === currentIndex;
        const isBlocked = index > currentIndex;
        const isDone = step.status === "completo" || step.status === "parcial";
        const isLast = index === steps.length - 1;

        return (
          <div key={step.key} className="relative flex gap-4 px-5 py-4">
            {!isLast && (
              <div
                className={cn(
                  "absolute left-[35px] top-[52px] bottom-0 w-px",
                  isDone ? "bg-emerald-300" : "bg-border"
                )}
              />
            )}

            {step.status === "completo" && step.isManual ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-emerald-500 bg-emerald-50 text-emerald-600">
                    <Check className="h-4 w-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Marcado manualmente</TooltipContent>
              </Tooltip>
            ) : (
              <div
                className={cn(
                  "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                  step.status === "completo" && "border-emerald-500 bg-emerald-500 text-white",
                  step.status === "parcial" && "border-amber-500 bg-amber-100 text-amber-700",
                  isCurrent && "border-blue-500 bg-blue-50 text-blue-700",
                  isBlocked && "border-border bg-muted text-muted-foreground"
                )}
              >
                {step.status === "completo" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
            )}

            <div className="flex-1 space-y-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={cn(
                    "text-sm font-semibold",
                    step.status === "completo" && "text-emerald-700",
                    isCurrent && "text-blue-700",
                    isBlocked && "text-muted-foreground"
                  )}
                >
                  {step.title}
                </h3>
                {step.status === "parcial" && (
                  <Badge variant="outline" className="border-amber-400/50 bg-amber-100 text-amber-700">
                    Parcial
                  </Badge>
                )}
              </div>
              <p className={cn("text-sm", isBlocked ? "text-muted-foreground/70" : "text-muted-foreground")}>
                {step.description}
              </p>

              <div className="pt-1.5">
                {isBlocked ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-block">
                        <Button size="sm" variant="outline" disabled className="pointer-events-none">
                          {step.actionLabel}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Complete a etapa anterior primeiro</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button size="sm" variant={isCurrent ? "default" : "outline"} asChild>
                    <Link href={step.href}>{step.actionLabel}</Link>
                  </Button>
                )}
              </div>

              {!isBlocked && (step.isManual || step.status !== "completo") && (
                <div>
                  <StepManualCompleteButton projectId={projectId} etapa={step.etapa} isManual={step.isManual} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
