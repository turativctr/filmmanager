import { AcompanhamentoTab } from "@/components/budget/acompanhamento-tab";
import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetAcompanhamentoPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data) return <CreateBudgetCard projectId={params.id} />;
  return <AcompanhamentoTab projectId={params.id} budget={data} />;
}
