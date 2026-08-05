import { GuidedProgressPanel } from "@/components/projects/guided-progress-panel";
import { PageHeader } from "@/components/shared/page-header";
import { computeProjectSteps } from "@/lib/project-step";

export default async function GuiaPage({ params }: { params: { id: string } }) {
  const steps = await computeProjectSteps(params.id);

  return (
    <div className="space-y-4">
      <PageHeader title="Guia de preenchimento" />
      <GuidedProgressPanel projectId={params.id} steps={steps} />
    </div>
  );
}
