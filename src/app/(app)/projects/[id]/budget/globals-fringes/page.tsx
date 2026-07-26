import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { GlobalsFringesTab } from "@/components/budget/globals-fringes-tab";
import { PageHeader } from "@/components/shared/page-header";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetGlobalsFringesPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data)
    return (
      <div className="space-y-4">
        <PageHeader title="Globais e Encargos" />
        <CreateBudgetCard projectId={params.id} />
      </div>
    );
  return (
    <div className="space-y-4">
      <PageHeader title="Globals e Fringes" />
      <GlobalsFringesTab projectId={params.id} budget={data} />
    </div>
  );
}
