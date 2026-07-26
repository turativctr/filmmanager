import { AcompanhamentoTab } from "@/components/budget/acompanhamento-tab";
import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { PageHeader } from "@/components/shared/page-header";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetAcompanhamentoPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data)
    return (
      <div className="space-y-4">
        <PageHeader title="Acompanhamento" />
        <CreateBudgetCard projectId={params.id} />
      </div>
    );
  return (
    <div className="space-y-4">
      <PageHeader title="Acompanhamento" />
      <AcompanhamentoTab projectId={params.id} budget={data} />
    </div>
  );
}
