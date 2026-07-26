import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { ScenariosTab } from "@/components/budget/scenarios-tab";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetCenariosPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data) return <CreateBudgetCard projectId={params.id} />;
  return <ScenariosTab projectId={params.id} budget={data} />;
}
