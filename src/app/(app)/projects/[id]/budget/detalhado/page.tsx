import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { DetailTab } from "@/components/budget/detail-tab";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetDetalhadoPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data) return <CreateBudgetCard projectId={params.id} />;
  return <DetailTab projectId={params.id} budget={data} />;
}
