import { OnboardingWizard } from "@/components/onboarding/wizard";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo projeto</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados básicos e, se já tiver um roteiro, envie para criar cenas e
          personagens automaticamente.
        </p>
      </div>
      <OnboardingWizard />
    </div>
  );
}
