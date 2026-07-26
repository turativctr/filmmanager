import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { DetailTab } from "@/components/budget/detail-tab";
import { PageHeader } from "@/components/shared/page-header";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetDetalhadoPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data)
    return (
      <div className="space-y-4">
        <PageHeader title="Detalhado" />
        <CreateBudgetCard projectId={params.id} />
      </div>
    );
  return (
    <div className="space-y-4">
      <PageHeader title="Detalhado" />
      <DetailTab projectId={params.id} budget={data} />
    </div>
  );
}
