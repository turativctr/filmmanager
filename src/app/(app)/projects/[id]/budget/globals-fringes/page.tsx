import { CreateBudgetCard } from "@/components/budget/create-budget-card";
import { GlobalsFringesTab } from "@/components/budget/globals-fringes-tab";
import { getBudgetData } from "@/lib/budget-data";

export default async function BudgetGlobalsFringesPage({ params }: { params: { id: string } }) {
  const data = await getBudgetData(params.id);
  if (!data) return <CreateBudgetCard projectId={params.id} />;
  return <GlobalsFringesTab projectId={params.id} budget={data} />;
}
