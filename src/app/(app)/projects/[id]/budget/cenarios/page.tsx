import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { ScenariosTab } from "@/components/budget/scenarios-tab";
import { PageHeader } from "@/components/shared/page-header";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetCenariosPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data)
    return (
      <div className="space-y-4">
        <PageHeader title="Cenários" />
        <CreateBudgetCard projectId={params.id} />
      </div>
    );
  return (
    <div className="space-y-4">
      <PageHeader title="Cenários" />
      <ScenariosTab projectId={params.id} budget={data} />
    </div>
  );
}
